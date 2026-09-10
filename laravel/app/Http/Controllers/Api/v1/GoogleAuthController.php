<?php

namespace App\Http\Controllers\Api\v1;

use App\Actions\Auth\RegisterUserAction;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Platform\UserDeviceBindingService;
use App\Support\TokenPolicy;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Laravel\Socialite\Facades\Socialite;

/**
 * Google OAuth — Web (FRONTEND_URL) + Mobile deep-link (gurkypay:// / Expo Linking).
 * Mobile: GET /auth/google/redirect?client=mobile&redirect_uri=gurkypay://auth/google
 * Web unchanged when client omitted / client=web.
 */
class GoogleAuthController extends Controller
{
    public function redirect(Request $request): RedirectResponse
    {
        $client = strtolower((string) $request->query('client', 'web'));
        if (!in_array($client, ['web', 'mobile'], true)) {
            $client = 'web';
        }

        $redirectUri = (string) $request->query('redirect_uri', '');
        if ($client === 'mobile' && !$this->isAllowedMobileRedirect($redirectUri)) {
            $frontendUrl = rtrim((string) config('services.frontend_url', env('FRONTEND_URL', '/')), '/');
            return redirect()->away($frontendUrl . '/login?google_error=' . urlencode('Redirect URI Mobile tidak valid.'));
        }

        $stateKey = Str::random(40);
        Cache::put('google_oauth_ctx:' . $stateKey, [
            'client' => $client,
            'redirect_uri' => $client === 'mobile' ? $redirectUri : null,
            'issued_at' => now()->timestamp,
        ], now()->addMinutes(15));

        return Socialite::driver('google')
            ->stateless()
            ->with(['state' => $stateKey])
            ->redirect();
    }

    public function callback(Request $request, RegisterUserAction $registerAction): RedirectResponse
    {
        $frontendUrl = rtrim((string) config('services.frontend_url', env('FRONTEND_URL', '/')), '/');
        $ctx = $this->resolveOAuthContext($request);
        $client = $ctx['client'] ?? 'web';
        $mobileRedirect = $ctx['redirect_uri'] ?? null;

        try {
            $googleUser = Socialite::driver('google')->stateless()->user();
        } catch (\Throwable $e) {
            Log::warning('Google OAuth callback failed', ['error' => $e->getMessage()]);
            return $this->oauthErrorRedirect($client, $mobileRedirect, $frontendUrl, 'Login Google gagal, coba lagi.');
        }

        $email = $googleUser->getEmail();
        if (!$email) {
            return $this->oauthErrorRedirect($client, $mobileRedirect, $frontendUrl, 'Akun Google tidak memiliki email publik.');
        }

        $user = User::query()->where('google_id', $googleUser->getId())->first();

        if (!$user) {
            $user = User::query()->where('email', $email)->first();
            if ($user) {
                $user->forceFill(['google_id' => $googleUser->getId()])->save();
            }
        }

        if ($user) {
            $token = $user->createToken('google-oauth', ['*'], TokenPolicy::expiresAtFor($user))->plainTextToken;
            $this->rememberTrustedDeviceFromHeaders($user, $request);

            if ($client === 'mobile' && $mobileRedirect) {
                return redirect()->away($this->appendQuery($mobileRedirect, [
                    'token' => $token,
                ]));
            }

            return redirect()->away($frontendUrl . '/auth/google/landing?token=' . urlencode($token));
        }

        $payload = [
            'google_id' => $googleUser->getId(),
            'email' => $email,
            'name' => $googleUser->getName() ?: $googleUser->getNickname() ?: 'Pengguna GurkyNet',
            'avatar' => $googleUser->getAvatar(),
            'issued_at' => now()->timestamp,
        ];
        $googleToken = Crypt::encryptString(json_encode($payload));

        if ($client === 'mobile' && $mobileRedirect) {
            return redirect()->away($this->appendQuery($mobileRedirect, [
                'google_token' => $googleToken,
            ]));
        }

        return redirect()->away($frontendUrl . '/register/google-complete?google_token=' . urlencode($googleToken));
    }

    public function complete(Request $request, RegisterUserAction $registerAction)
    {
        $data = $request->validate([
            'google_token' => 'required|string',
            'phone_number' => 'required|string|unique:users,phone_number|regex:/^08[0-9]{8,11}$/',
            'pin' => 'required|string|regex:/^\d{6}$/',
            'pin_confirmation' => 'required|same:pin',
            'referral_code' => 'nullable|string|min:6|max:20|regex:/^[A-Za-z0-9]+$/',
            'accept_policies' => 'accepted',
        ]);

        try {
            $decoded = json_decode(Crypt::decryptString($data['google_token']), true);
        } catch (\Throwable $e) {
            abort(422, 'Sesi Google Sign-In sudah tidak valid, silakan ulangi.');
        }

        if (!is_array($decoded) || empty($decoded['email']) || empty($decoded['google_id'])) {
            abort(422, 'Sesi Google Sign-In tidak valid.');
        }
        if (now()->timestamp - (int) ($decoded['issued_at'] ?? 0) > 900) {
            abort(422, 'Sesi Google Sign-In sudah kedaluwarsa, silakan ulangi dari awal.');
        }
        if (User::query()->where('email', $decoded['email'])->orWhere('google_id', $decoded['google_id'])->exists()) {
            abort(422, 'Akun dengan email ini sudah terdaftar. Silakan masuk dengan Google langsung.');
        }

        $user = $registerAction->execute([
            'name' => $decoded['name'],
            'email' => $decoded['email'],
            'phone_number' => $data['phone_number'],
            'password' => Str::random(40),
            'google_id' => $decoded['google_id'],
            'transaction_pin' => $data['pin'],
            'email_verified_at' => now(),
            'referral_code' => $data['referral_code'] ?? null,
            'referral_context' => ['ip' => $request->ip()],
            'accept_policies' => true,
        ]);

        $token = $user->createToken('google-oauth', ['*'], TokenPolicy::expiresAtFor($user))->plainTextToken;
        $this->rememberTrustedDeviceFromHeaders($user, $request);

        return response()->json([
            'success' => true,
            'message' => 'Akun berhasil dibuat.',
            'data' => [
                'token' => $token,
                'user' => new \App\Http\Resources\ProfileResource($user->fresh(['wallet'])),
            ],
        ]);
    }

    /**
     * @return array{client: string, redirect_uri: ?string}
     */
    protected function resolveOAuthContext(Request $request): array
    {
        $state = (string) $request->query('state', '');
        if ($state !== '') {
            $ctx = Cache::pull('google_oauth_ctx:' . $state);
            if (is_array($ctx) && !empty($ctx['client'])) {
                return [
                    'client' => (string) $ctx['client'],
                    'redirect_uri' => isset($ctx['redirect_uri']) ? (string) $ctx['redirect_uri'] : null,
                ];
            }
        }

        return ['client' => 'web', 'redirect_uri' => null];
    }

    protected function isAllowedMobileRedirect(string $uri): bool
    {
        if ($uri === '' || strlen($uri) > 512) {
            return false;
        }

        $allowed = config('services.google.mobile_redirect_prefixes', [
            'gurkypay://',
            'exp://',
        ]);

        foreach ($allowed as $prefix) {
            if (str_starts_with($uri, (string) $prefix)) {
                return true;
            }
        }

        return false;
    }

    protected function oauthErrorRedirect(string $client, ?string $mobileRedirect, string $frontendUrl, string $message): RedirectResponse
    {
        if ($client === 'mobile' && $mobileRedirect) {
            return redirect()->away($this->appendQuery($mobileRedirect, [
                'google_error' => $message,
            ]));
        }

        return redirect()->away($frontendUrl . '/login?google_error=' . urlencode($message));
    }

    /**
     * @param array<string, string> $params
     */
    protected function appendQuery(string $base, array $params): string
    {
        $sep = str_contains($base, '?') ? '&' : '?';
        return $base . $sep . http_build_query($params);
    }

    protected function rememberTrustedDeviceFromHeaders(User $user, Request $request): void
    {
        $deviceUuid = $request->header('X-Device-UUID', $request->input('device_uuid'));
        // Browser OAuth callback usually has no Mobile device headers — skip silently.
        if (!$deviceUuid) {
            return;
        }

        $platform = strtolower((string) $request->header('X-Platform', $request->input('platform', 'android')));
        if (!in_array($platform, ['android', 'ios', 'web', 'pwa'], true)) {
            $platform = 'android';
        }

        // P0 #4 — bind only unbound or own rows; never steal another user's device.
        app(UserDeviceBindingService::class)->claimOrUpdate(
            (int) $user->id,
            (string) $deviceUuid,
            $platform,
            [
                'app_version' => $request->header('X-App-Version'),
                'device_model' => substr((string) $request->header('X-Device-Model', ''), 0, 128) ?: null,
                'os_version' => substr((string) $request->header('X-Os-Version', ''), 0, 64) ?: null,
                'user_agent' => substr((string) $request->userAgent(), 0, 512),
                'is_active' => true,
                'last_seen_at' => now(),
            ]
        );
    }
}
