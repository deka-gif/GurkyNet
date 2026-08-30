<?php

namespace App\Http\Controllers\Api\v1;

use App\Actions\Auth\RegisterUserAction;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\TokenPolicy;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Laravel\Socialite\Facades\Socialite;

class GoogleAuthController extends Controller
{
    public function redirect(): RedirectResponse
    {
        return Socialite::driver('google')->stateless()->redirect();
    }

    public function callback(Request $request, RegisterUserAction $registerAction): RedirectResponse
    {
        $frontendUrl = rtrim((string) config('services.frontend_url', env('FRONTEND_URL', '/')), '/');

        try {
            $googleUser = Socialite::driver('google')->stateless()->user();
        } catch (\Throwable $e) {
            Log::warning('Google OAuth callback failed', ['error' => $e->getMessage()]);
            return redirect()->away($frontendUrl . '/login?google_error=' . urlencode('Login Google gagal, coba lagi.'));
        }

        $email = $googleUser->getEmail();
        if (!$email) {
            return redirect()->away($frontendUrl . '/login?google_error=' . urlencode('Akun Google tidak memiliki email publik.'));
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

        return response()->json([
            'success' => true,
            'message' => 'Akun berhasil dibuat.',
            'data' => [
                'token' => $token,
                'user' => new \App\Http\Resources\ProfileResource($user->fresh(['wallet'])),
            ],
        ]);
    }
}
