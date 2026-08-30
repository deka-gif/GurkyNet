<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\v1\RegisterRequest;
use App\Http\Requests\Api\v1\LoginRequest;
use App\Http\Requests\Api\v1\VerifyOtpRequest;
use App\Http\Requests\Api\v1\ResetPasswordRequest;
use App\Http\Requests\Api\v1\ChangePinRequest;
use App\Actions\Auth\RegisterUserAction;
use App\Actions\Auth\LoginUserAction;
use App\Actions\Auth\LogoutUserAction;
use App\Actions\Auth\VerifyOtpAction;
use App\Actions\Auth\ResetPasswordAction;
use App\Actions\Auth\ChangePinAction;
use App\Models\ActivityLog;
use App\Models\OnboardingAttempt;
use App\Models\User;
use App\Models\UserDevice;
use App\Repositories\Contracts\OtpRepositoryInterface;
use App\Repositories\Contracts\UserRepositoryInterface;
use App\Services\Security\OtpService;
use App\Support\TokenPolicy;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    use ApiResponseTrait;

    protected RegisterUserAction $registerAction;
    protected LoginUserAction $loginAction;
    protected LogoutUserAction $logoutAction;
    protected VerifyOtpAction $verifyOtpAction;
    protected ResetPasswordAction $resetPasswordAction;
    protected ChangePinAction $changePinAction;
    protected OtpRepositoryInterface $otpRepository;
    protected UserRepositoryInterface $userRepository;
    protected OtpService $unifiedOtpService;

    public function __construct(
        RegisterUserAction $registerAction,
        LoginUserAction $loginAction,
        LogoutUserAction $logoutAction,
        VerifyOtpAction $verifyOtpAction,
        ResetPasswordAction $resetPasswordAction,
        ChangePinAction $changePinAction,
        OtpRepositoryInterface $otpRepository,
        UserRepositoryInterface $userRepository,
        OtpService $unifiedOtpService
    ) {
        $this->registerAction = $registerAction;
        $this->loginAction = $loginAction;
        $this->logoutAction = $logoutAction;
        $this->verifyOtpAction = $verifyOtpAction;
        $this->resetPasswordAction = $resetPasswordAction;
        $this->changePinAction = $changePinAction;
        $this->otpRepository = $otpRepository;
        $this->userRepository = $userRepository;
        $this->unifiedOtpService = $unifiedOtpService;
    }

    /**
     * Handle User Registration.
     */
    public function register(RegisterRequest $request): JsonResponse
    {
        try {
            $data = $request->validated();

            $existingAttempt = OnboardingAttempt::query()
                ->where('email', $data['email'])
                ->orWhere('phone_number', $data['phone_number'])
                ->latest()
                ->first();

            if ($existingAttempt && $existingAttempt->status === 'verified') {
                $existingAttempt->delete();
            }

            $attempt = OnboardingAttempt::updateOrCreate(
                ['email' => $data['email']],
                [
                    'name' => $data['name'],
                    'phone_number' => $data['phone_number'],
                    'password' => Crypt::encryptString($data['password']),
                    'otp_code' => null,
                    'otp_expires_at' => null,
                    'otp_verified_at' => null,
                    'status' => 'pending_verification',
                    'meta' => [
                        'channel' => 'email',
                        'referral_code' => $data['referral_code'] ?? null,
                    ],
                ]
            );
            $otp = $this->unifiedOtpService->issue($attempt->email, 'onboarding_registration', 'email', null, [
                'onboarding_id' => $attempt->id,
            ], 10);
            $attempt->forceFill([
                'otp_code' => $otp->code,
                'otp_expires_at' => $otp->expires_at,
            ])->save();

            $payload = [
                'onboarding_id' => $attempt->id,
                'email' => $attempt->email,
                'status' => $attempt->status,
                'expires_at' => optional($attempt->otp_expires_at)->toIso8601String(),
                'user' => [
                    'name' => $attempt->name,
                    'email' => $attempt->email,
                    'phone' => $attempt->phone_number,
                    'isVerified' => false,
                    'hasPin' => false,
                ],
            ];

            if (app()->environment('local', 'testing')) {
                $payload['dummy_sent_code'] = $otp->code;
            }

            return $this->successResponse('OTP verifikasi telah dikirim ke email Anda.', $payload, 201);
        } catch (\Exception $e) {
            Log::error('Registration failed: ' . $e->getMessage());
            return $this->errorResponse('Terjadi kesalahan saat registrasi. Silakan coba lagi.', 500);
        }
    }

    /**
     * Handle User Login.
     */
    public function login(LoginRequest $request): JsonResponse
    {
        try {
            $device = $request->header('User-Agent', 'Default-Device');
            $result = $this->loginAction->execute(
                $request->phone_or_email,
                $request->password,
                $device
            );

            // SRS Bagian 8.1 — Sprint 2 keputusan #2: Finance & Owner wajib 2FA.
            // Password sudah valid, TAPI token belum diterbitkan — menunggu
            // verifikasi OTP via /auth/login/2fa/verify.
            if (!empty($result['requires_2fa'])) {
                $this->writeSecurityAudit($result['user'], 'login_2fa_challenge_issued');

                return $this->successResponse('Kode verifikasi 2FA telah dikirim ke email Anda.', [
                    'requires_2fa' => true,
                    'identifier' => $result['identifier'],
                    'expires_at' => optional($result['expires_at'])->toIso8601String(),
                    'resend_available_at' => optional($result['resend_available_at'])->toIso8601String(),
                    'dummy_sent_code' => app()->environment('local', 'testing') ? ($result['dummy_sent_code'] ?? null) : null,
                ]);
            }

            $result['user'] = new \App\Http\Resources\ProfileResource($result['user']);
            $this->writeSecurityAudit($result['user']->resource ?? $result['user'], 'login_password');

            return $this->successResponse('Login berhasil dilakukan.', $result);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return $this->errorResponse($e->getMessage(), 422, $e->errors());
        } catch (\Exception $e) {
            Log::error('Login failed: ' . $e->getMessage());
            return $this->errorResponse('Terjadi kesalahan saat mencoba masuk.', 500);
        }
    }

    /**
     * Verifikasi OTP 2FA (Finance/Owner) dan selesaikan login dengan
     * menerbitkan token Sanctum. SRS Bagian 8.1 — Sprint 2 keputusan #2.
     * Menggunakan OtpService existing (tidak membuat mekanisme OTP baru).
     */
    public function verifyLogin2fa(Request $request): JsonResponse
    {
        $data = $request->validate([
            'identity' => 'required|string',
            'code' => 'required|string|size:6',
        ], [], [
            'identity' => 'identitas (email/nomor HP)',
        ]);

        try {
            $user = filter_var($data['identity'], FILTER_VALIDATE_EMAIL)
                ? User::query()->where('email', $data['identity'])->first()
                : User::query()->where('phone_number', $data['identity'])->first();

            if (!$user || !\App\Actions\Auth\LoginUserAction::requiresTwoFactor($user)) {
                return $this->errorResponse('Permintaan verifikasi 2FA tidak valid.', 422);
            }

            $this->unifiedOtpService->verify(
                $user->email,
                $data['code'],
                \App\Actions\Auth\LoginUserAction::TWO_FACTOR_OTP_ACTION,
                'email',
                $user->id
            );

            $tokenName = $this->deviceTokenName($request);
            $token = $user->createToken($tokenName, ['*'], TokenPolicy::expiresAtFor($user))->plainTextToken;
            $this->writeSecurityAudit($user, 'login_2fa_verified');

            return $this->successResponse('Verifikasi 2FA berhasil. Login selesai.', [
                'user' => new \App\Http\Resources\ProfileResource($user->fresh(['wallet'])),
                'token' => $token,
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return $this->errorResponse($e->getMessage(), 422, $e->errors());
        } catch (\Exception $e) {
            Log::error('2FA login verification failed: ' . $e->getMessage());
            return $this->errorResponse('Terjadi kesalahan saat memverifikasi kode 2FA.', 500);
        }
    }

    /**
     * Get Current Authenticated User & Wallet.
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return $this->errorResponse('Sesi Anda telah kedaluwarsa atau tidak valid.', 401);
        }

        return $this->successResponse('Detail data pengguna berhasil didapatkan.', [
            'user' => new \App\Http\Resources\ProfileResource($user),
        ]);
    }

    /**
     * Refresh Authentication Session (Sanctum token rotation).
     * Compatible with Android / iOS / PWA / Website clients.
     */
    public function refresh(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return $this->errorResponse('Sesi Anda telah kedaluwarsa.', 401);
        }

        $platform = strtolower((string) $request->header('X-Platform', $request->input('platform', 'web')));
        $deviceUuid = $request->header('X-Device-UUID', $request->input('device_uuid'));
        $appVersion = $request->header('X-App-Version', $request->input('app_version'));
        $tokenName = trim($platform . '|' . ($deviceUuid ?: $request->header('User-Agent', 'Refreshed-Device')));

        $user->currentAccessToken()->delete();
        $newToken = $user->createToken($tokenName, ['*'], TokenPolicy::expiresAtFor($user))->plainTextToken;

        if ($deviceUuid) {
            \App\Models\UserDevice::updateOrCreate(
                [
                    'device_uuid' => $deviceUuid,
                    'platform' => in_array($platform, ['android', 'ios', 'web', 'pwa'], true) ? $platform : 'web',
                ],
                [
                    'user_id' => $user->id,
                    'app_version' => $appVersion,
                    'user_agent' => substr((string) $request->userAgent(), 0, 512),
                    'is_active' => true,
                    'last_seen_at' => now(),
                ]
            );
        }

        return $this->successResponse('Token otentikasi berhasil diperbarui.', [
            'user' => new \App\Http\Resources\ProfileResource($user),
            'token' => $newToken,
            'token_type' => 'Bearer',
            'platform' => $platform,
        ]);
    }

    /**
     * Validate current Sanctum session for mobile / PWA clients.
     * GET /api/v1/auth/session
     */
    public function session(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return $this->errorResponse('Sesi tidak valid.', 401);
        }

        $token = $user->currentAccessToken();

        return $this->successResponse('Sesi valid.', [
            'valid' => true,
            'user' => new \App\Http\Resources\ProfileResource($user),
            'token_name' => $token?->name,
            'token_abilities' => $token?->abilities ?? ['*'],
            'last_used_at' => optional($token?->last_used_at)?->toIso8601String(),
            'created_at' => optional($token?->created_at)?->toIso8601String(),
        ]);
    }

    /**
     * Handle Logout.
     */
    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return $this->errorResponse('Sesi Anda telah kedaluwarsa atau tidak valid.', 401);
        }

        $this->logoutAction->execute($user);
        return $this->successResponse('Logout berhasil dilakukan.');
    }

    /**
     * Generate & Request OTP Code (Dummy Sender Implementation).
     */
    public function requestOtp(Request $request): JsonResponse
    {
        $request->validate([
            'phone_number' => 'nullable|string',
            'email' => 'nullable|email',
            'action' => 'required|string|in:registration,pin_reset,password_reset,verification,forgot_password,forgot_pin,change_password,change_pin,change_phone,change_email_old,change_email_new,onboarding_registration,login_2fa',
        ], [
            'action.in' => 'Format aksi OTP tidak valid.',
        ]);

        $identifier = (string) ($request->input('email') ?: $request->input('phone_number'));
        $action = $request->action;
        $channel = filter_var($identifier, FILTER_VALIDATE_EMAIL) ? 'email' : 'phone';
        $otp = $this->unifiedOtpService->issue($identifier, $action, $channel);

        return $this->successResponse('Kode OTP berhasil dikirim.', [
            'identifier' => $identifier,
            'phone_number' => $channel === 'phone' ? $identifier : null,
            'email' => $channel === 'email' ? $identifier : null,
            'action' => $action,
            'expires_at' => $otp->expires_at?->toIso8601String(),
            'resend_available_at' => $otp->resend_available_at?->toIso8601String(),
            'dummy_sent_code' => app()->environment('local', 'testing') ? $otp->code : null,
        ]);
    }

    /**
     * Verify OTP Code.
     */
    public function verifyOtp(VerifyOtpRequest $request): JsonResponse
    {
        try {
            if ($request->filled('onboarding_id')) {
                $attempt = OnboardingAttempt::query()->findOrFail((int) $request->input('onboarding_id'));
                $this->unifiedOtpService->verify($attempt->email, $request->code, 'onboarding_registration', 'email');

                $attempt->forceFill([
                    'otp_verified_at' => now(),
                    'otp_code' => null,
                    'status' => 'verified',
                ])->save();

                return $this->successResponse('Kode OTP berhasil diverifikasi.', [
                    'onboarding_id' => $attempt->id,
                    'verified' => true,
                    'status' => 'verified',
                    'next_step' => 'create_pin',
                ]);
            }

            $this->verifyOtpAction->execute(
                $request->phone_number,
                $request->code,
                $request->action
            );

            return $this->successResponse('Kode OTP berhasil diverifikasi.', [
                'phone_number' => $request->phone_number,
                'action' => $request->action,
                'verified' => true,
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return $this->errorResponse($e->getMessage(), 422, $e->errors());
        } catch (\Exception $e) {
            Log::error('OTP verification failed: ' . $e->getMessage());
            return $this->errorResponse('Terjadi kesalahan saat memverifikasi OTP.', 500);
        }
    }

    public function resendOnboardingOtpWhatsapp(Request $request): JsonResponse
    {
        $request->validate(['onboarding_id' => 'required|integer|exists:onboarding_attempts,id']);
        $attempt = OnboardingAttempt::query()->findOrFail((int) $request->input('onboarding_id'));

        if (!$attempt->phone_number) {
            return $this->errorResponse('Nomor HP tidak ditemukan pada pendaftaran ini.', 422);
        }

        try {
            $otp = $this->unifiedOtpService->issue(
                $attempt->email,
                'onboarding_registration',
                'email',
                null,
                ['onboarding_id' => $attempt->id],
                10,
                60,
                5,
                ['via' => 'whatsapp', 'phone' => $attempt->phone_number]
            );
        } catch (\Illuminate\Validation\ValidationException $e) {
            return $this->errorResponse($e->getMessage(), 422, $e->errors());
        }

        return $this->successResponse('Kode OTP dikirim ke WhatsApp Anda.', [
            'onboarding_id' => $attempt->id,
            'expires_at' => $otp->expires_at?->toIso8601String(),
        ]);
    }

    public function finalizeRegistration(Request $request): JsonResponse
    {
        $data = $request->validate([
            'onboarding_id' => 'required|integer|exists:onboarding_attempts,id',
            'pin' => 'required|string|regex:/^\d{6}$/',
            'pin_confirmation' => 'required|same:pin',
            'remember_device' => 'nullable|boolean',
            // Sprint 18 — server-side policy acceptance (Bagian 27/28)
            'accept_policies' => 'accepted',
        ]);

        if ($this->isWeakPin($data['pin'])) {
            return $this->errorResponse('PIN terlalu lemah. Gunakan kombinasi 6 digit lain.', 422, [
                'pin' => ['PIN terlalu lemah. Gunakan kombinasi 6 digit lain.'],
            ]);
        }

        /** @var OnboardingAttempt $attempt */
        $attempt = OnboardingAttempt::query()->findOrFail((int) $data['onboarding_id']);
        if (!$attempt->otp_verified_at) {
            return $this->errorResponse('OTP email belum diverifikasi.', 422, [
                'onboarding_id' => ['OTP email belum diverifikasi.'],
            ]);
        }

        $result = DB::transaction(function () use ($attempt, $data, $request) {
            $meta = is_array($attempt->meta) ? $attempt->meta : [];
            $user = $this->registerAction->execute([
                'name' => $attempt->name,
                'email' => $attempt->email,
                'phone_number' => $attempt->phone_number,
                'password' => Crypt::decryptString($attempt->password),
                'transaction_pin' => $data['pin'],
                'email_verified_at' => now(),
                'referral_code' => $meta['referral_code'] ?? null,
                'referral_context' => [
                    'ip' => $request->ip(),
                    'device_fingerprint' => $request->header('X-Device-Id'),
                ],
                'accept_policies' => true,
            ]);

            $tokenName = $this->deviceTokenName($request);
            $token = $user->createToken($tokenName, ['*'], TokenPolicy::expiresAtFor($user))->plainTextToken;
            $this->rememberTrustedDevice($user, $request, (bool) ($data['remember_device'] ?? true));
            $this->writeSecurityAudit($user, 'REGISTER_AND_CREATE_PIN', [
                'channel' => 'email_otp',
            ]);

            $attempt->forceFill([
                'status' => 'completed',
                'otp_code' => null,
            ])->delete();

            return [
                'user' => $user->fresh(['wallet']),
                'token' => $token,
            ];
        });

        return $this->successResponse('Akun berhasil diverifikasi dan PIN berhasil dibuat.', [
            'token' => $result['token'],
            'user' => new \App\Http\Resources\ProfileResource($result['user']),
        ]);
    }

    /**
     * Reset Password via OTP Code validation.
     */
    public function resetPassword(ResetPasswordRequest $request): JsonResponse
    {
        try {
            $this->resetPasswordAction->execute(
                $request->phone_number,
                $request->otp_code,
                $request->password
            );

            return $this->successResponse('Kata sandi Anda berhasil diperbarui. Silakan login kembali.');
        } catch (\Illuminate\Validation\ValidationException $e) {
            return $this->errorResponse($e->getMessage(), 422, $e->errors());
        } catch (\Exception $e) {
            Log::error('Password reset failed: ' . $e->getMessage());
            return $this->errorResponse('Terjadi kesalahan saat memperbarui kata sandi.', 500);
        }
    }

    /**
     * Set or Change Transaction PIN (6-digit hashed).
     */
    public function changePin(ChangePinRequest $request): JsonResponse
    {
        try {
            $user = $request->user();
            if (!$user) {
                return $this->errorResponse('Sesi Anda tidak valid.', 401);
            }

            $this->changePinAction->execute(
                $user,
                $request->new_pin,
                $request->old_pin
            );

            return $this->successResponse('PIN transaksi Anda berhasil diperbarui.');
        } catch (\Illuminate\Validation\ValidationException $e) {
            return $this->errorResponse($e->getMessage(), 422, $e->errors());
        } catch (\Exception $e) {
            Log::error('PIN modification failed: ' . $e->getMessage());
            return $this->errorResponse('Terjadi kesalahan saat memproses PIN transaksi Anda.', 500);
        }
    }

    public function pinLogin(Request $request): JsonResponse
    {
        $data = $request->validate([
            'identity' => 'required|string',
            'pin' => 'required|string|regex:/^\d{6}$/',
        ]);

        $user = filter_var($data['identity'], FILTER_VALIDATE_EMAIL)
            ? User::query()->where('email', $data['identity'])->first()
            : User::query()->where('phone_number', $data['identity'])->first();

        if (!$user || !$user->hasPin() || !Hash::check($data['pin'], (string) $user->transaction_pin)) {
            return $this->errorResponse('PIN login tidak valid.', 422, [
                'pin' => ['PIN login tidak valid.'],
            ]);
        }

        if (!$this->isTrustedDevice($user, $request)) {
            return $this->errorResponse('Perangkat ini belum dipercaya. Gunakan login email + password terlebih dahulu.', 403);
        }

        // SRS Bagian 8.1 — Sprint 2 keputusan #2: 2FA wajib Finance & Owner,
        // berlaku juga untuk jalur PIN login (tidak boleh jadi jalur bypass 2FA).
        if (\App\Actions\Auth\LoginUserAction::requiresTwoFactor($user)) {
            $result = $this->loginAction->challengeTwoFactor($user);
            $this->writeSecurityAudit($user, 'login_2fa_challenge_issued');

            return $this->successResponse('Kode verifikasi 2FA telah dikirim ke email Anda.', [
                'requires_2fa' => true,
                'identifier' => $result['identifier'],
                'expires_at' => optional($result['expires_at'])->toIso8601String(),
                'resend_available_at' => optional($result['resend_available_at'])->toIso8601String(),
                'dummy_sent_code' => app()->environment('local', 'testing') ? ($result['dummy_sent_code'] ?? null) : null,
            ]);
        }

        $token = $user->createToken($this->deviceTokenName($request), ['*'], TokenPolicy::expiresAtFor($user))->plainTextToken;
        $this->rememberTrustedDevice($user, $request, true);
        $this->writeSecurityAudit($user, 'login_pin');

        return $this->successResponse('Login PIN berhasil dilakukan.', [
            'token' => $token,
            'user' => new \App\Http\Resources\ProfileResource($user->fresh(['wallet'])),
        ]);
    }

    protected function sendOnboardingOtpEmail(OnboardingAttempt $attempt, string $otpCode): void
    {
        $apiKey = config('services.resend.key');
        if (!$apiKey) {
            Log::warning('RESEND key missing; onboarding OTP email skipped.', ['email' => $attempt->email]);
            return;
        }

        $response = Http::withToken($apiKey)
            ->acceptJson()
            ->post('https://api.resend.com/emails', [
                'from' => 'onboarding@resend.dev',
                'to' => [$attempt->email],
                'subject' => 'Kode OTP Verifikasi GurkyNet',
                'html' => '<p>Halo ' . e($attempt->name) . ',</p>'
                    . '<p>Kode OTP verifikasi akun GurkyNet Anda adalah:</p>'
                    . '<p style="font-size:28px;font-weight:700;letter-spacing:4px;">' . e($otpCode) . '</p>'
                    . '<p>Kode ini berlaku selama 10 menit.</p>',
            ]);

        Log::info('ONBOARDING OTP EMAIL', [
            'email' => $attempt->email,
            'status' => $response->status(),
        ]);
    }

    protected function isWeakPin(string $pin): bool
    {
        return in_array($pin, ['123456', '111111', '121212', '112233', '987654', '654321'], true);
    }

    protected function deviceTokenName(Request $request): string
    {
        $deviceUuid = $request->header('X-Device-UUID', $request->input('device_uuid', 'web-device'));
        $platform = strtolower((string) $request->header('X-Platform', $request->input('platform', 'web')));

        return $platform . '|' . $deviceUuid;
    }

    protected function rememberTrustedDevice(User $user, Request $request, bool $active = true): void
    {
        $deviceUuid = $request->header('X-Device-UUID', $request->input('device_uuid'));
        if (!$deviceUuid) {
            return;
        }

        UserDevice::updateOrCreate(
            ['device_uuid' => $deviceUuid, 'platform' => strtolower((string) $request->header('X-Platform', 'web'))],
            [
                'user_id' => $user->id,
                'app_version' => $request->header('X-App-Version'),
                'user_agent' => substr((string) $request->userAgent(), 0, 512),
                'is_active' => $active,
                'last_seen_at' => now(),
            ]
        );
        $this->writeSecurityAudit($user, 'trusted_device_added');
    }

    protected function isTrustedDevice(User $user, Request $request): bool
    {
        $deviceUuid = $request->header('X-Device-UUID', $request->input('device_uuid'));
        if (!$deviceUuid) {
            return false;
        }

        return UserDevice::query()
            ->where('user_id', $user->id)
            ->where('device_uuid', $deviceUuid)
            ->where('is_active', true)
            ->exists();
    }

    protected function writeSecurityAudit(User $user, string $activity, array $payload = []): void
    {
        ActivityLog::create([
            'user_id' => $user->id,
            'activity' => strtolower($activity),
            'payload' => array_merge($payload, [
                'timestamp' => now()->toIso8601String(),
            ]),
        ]);
    }
}
