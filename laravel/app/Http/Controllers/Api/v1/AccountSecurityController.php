<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\User;
use App\Models\UserDevice;
use App\Services\Security\OtpService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AccountSecurityController extends Controller
{
    use ApiResponseTrait;

    public function __construct(
        protected OtpService $otpService,
    ) {}

    public function requestPasswordChange(Request $request): JsonResponse
    {
        $data = $request->validate([
            'old_password' => 'required|string',
            'pin' => 'required|string|size:6',
        ]);

        $user = $request->user();
        $this->assertPasswordAndPin($user, $data['old_password'], $data['pin']);

        $otp = $this->otpService->issue($user->email, 'change_password', 'email', $user);

        return $this->successResponse('OTP perubahan password telah dikirim ke email Anda.', $this->otpPayload($otp));
    }

    public function confirmPasswordChange(Request $request): JsonResponse
    {
        $data = $request->validate([
            'otp_code' => 'required|string|size:6',
            'new_password' => 'required|string|min:8|confirmed',
        ]);

        $user = $request->user();
        $this->otpService->verify($user->email, $data['otp_code'], 'change_password', 'email', $user->id);

        $oldMasked = $this->maskValue($user->email);
        $user->forceFill(['password' => Hash::make($data['new_password'])])->save();
        $this->revokeOtherSessions($user, $request);
        $this->audit($user, 'password_changed', [
            'old_value' => $oldMasked,
            'new_value' => $oldMasked,
        ]);

        return $this->successResponse('Password berhasil diubah.');
    }

    public function requestForgotPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => 'required|email',
        ]);

        $user = User::query()->where('email', $data['email'])->first();
        if (!$user) {
            throw ValidationException::withMessages([
                'email' => ['Email tidak ditemukan di sistem kami.'],
            ]);
        }
        $otp = $this->otpService->issue($user->email, 'forgot_password', 'email', $user);

        return $this->successResponse('OTP reset password telah dikirim.', $this->otpPayload($otp));
    }

    public function confirmForgotPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => 'required|email',
            'otp_code' => 'required|string|size:6',
            'new_password' => 'required|string|min:8|confirmed',
        ]);

        $user = User::query()->where('email', $data['email'])->first();
        if (!$user) {
            throw ValidationException::withMessages([
                'email' => ['Email tidak ditemukan di sistem kami.'],
            ]);
        }
        $this->otpService->verify($user->email, $data['otp_code'], 'forgot_password', 'email', $user->id);

        $user->forceFill(['password' => Hash::make($data['new_password'])])->save();
        $user->tokens()->delete();
        UserDevice::query()->where('user_id', $user->id)->update(['is_active' => false]);
        $this->audit($user, 'password_reset', [
            'old_value' => $this->maskValue($user->email),
            'new_value' => $this->maskValue($user->email),
        ]);

        return $this->successResponse('Password berhasil direset. Silakan login kembali.');
    }

    public function requestPinChange(Request $request): JsonResponse
    {
        $data = $request->validate([
            'old_pin' => 'required|string|size:6',
        ]);

        $user = $request->user();
        if (!$user->transaction_pin || !Hash::check($data['old_pin'], $user->transaction_pin)) {
            throw ValidationException::withMessages(['old_pin' => ['PIN lama tidak valid.']]);
        }

        $otp = $this->otpService->issue($user->email, 'change_pin', 'email', $user);

        return $this->successResponse('OTP perubahan PIN telah dikirim.', $this->otpPayload($otp));
    }

    public function confirmPinChange(Request $request): JsonResponse
    {
        $data = $request->validate([
            'otp_code' => 'required|string|size:6',
            'pin' => 'required|string|size:6|confirmed',
        ]);

        $user = $request->user();
        $this->assertStrongPin($data['pin']);
        $this->otpService->verify($user->email, $data['otp_code'], 'change_pin', 'email', $user->id);
        $user->forceFill([
            'transaction_pin' => Hash::make($data['pin']),
            'pin_updated_at' => now(),
        ])->save();
        $this->audit($user, 'pin_changed');

        return $this->successResponse('PIN berhasil diubah.');
    }

    public function requestForgotPin(Request $request): JsonResponse
    {
        $data = $request->validate(['email' => 'required|email']);
        $user = User::query()->where('email', $data['email'])->first();
        if (!$user) {
            throw ValidationException::withMessages([
                'email' => ['Email tidak ditemukan di sistem kami.'],
            ]);
        }
        $otp = $this->otpService->issue($user->email, 'forgot_pin', 'email', $user);

        return $this->successResponse('OTP reset PIN telah dikirim.', $this->otpPayload($otp));
    }

    public function confirmForgotPin(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => 'required|email',
            'otp_code' => 'required|string|size:6',
            'pin' => 'required|string|size:6|confirmed',
        ]);

        $user = User::query()->where('email', $data['email'])->first();
        if (!$user) {
            throw ValidationException::withMessages([
                'email' => ['Email tidak ditemukan di sistem kami.'],
            ]);
        }
        $this->assertStrongPin($data['pin']);
        $this->otpService->verify($user->email, $data['otp_code'], 'forgot_pin', 'email', $user->id);
        $user->forceFill([
            'transaction_pin' => Hash::make($data['pin']),
            'pin_updated_at' => now(),
        ])->save();
        $this->audit($user, 'pin_reset');

        return $this->successResponse('PIN berhasil direset.');
    }

    public function requestEmailChange(Request $request): JsonResponse
    {
        $data = $request->validate([
            'password' => 'required|string',
            'pin' => 'required|string|size:6',
            'new_email' => 'required|email|unique:users,email',
        ]);

        $user = $request->user();
        $this->assertPasswordAndPin($user, $data['password'], $data['pin']);
        $otp = $this->otpService->issue($user->email, 'change_email_old', 'email', $user, [
            'new_email' => $data['new_email'],
        ]);

        return $this->successResponse('OTP telah dikirim ke email lama.', $this->otpPayload($otp));
    }

    public function verifyEmailChangeOld(Request $request): JsonResponse
    {
        $data = $request->validate([
            'otp_code' => 'required|string|size:6',
            'new_email' => 'required|email|unique:users,email',
        ]);

        $user = $request->user();
        $this->otpService->verify($user->email, $data['otp_code'], 'change_email_old', 'email', $user->id);
        $otp = $this->otpService->issue($data['new_email'], 'change_email_new', 'email', $user, [
            'old_email' => $user->email,
        ]);

        return $this->successResponse('OTP telah dikirim ke email baru.', $this->otpPayload($otp));
    }

    public function verifyEmailChangeNew(Request $request): JsonResponse
    {
        $data = $request->validate([
            'new_email' => 'required|email|unique:users,email',
            'otp_code' => 'required|string|size:6',
        ]);

        $user = $request->user();
        $oldEmail = $user->email;
        $this->otpService->verify($data['new_email'], $data['otp_code'], 'change_email_new', 'email', $user->id);
        $user->forceFill([
            'email' => $data['new_email'],
            'email_verified_at' => now(),
        ])->save();
        $this->audit($user, 'email_changed', [
            'old_value' => $oldEmail,
            'new_value' => $data['new_email'],
        ]);

        return $this->successResponse('Email berhasil diperbarui.');
    }

    public function requestPhoneChange(Request $request): JsonResponse
    {
        $data = $request->validate([
            'password' => 'required|string',
            'pin' => 'required|string|size:6',
            'new_phone' => 'required|string|regex:/^08[0-9]{8,11}$/|unique:users,phone_number',
        ]);

        $user = $request->user();
        $this->assertPasswordAndPin($user, $data['password'], $data['pin']);
        $otp = $this->otpService->issue($user->email, 'change_phone', 'email', $user, [
            'new_phone' => $data['new_phone'],
        ]);

        return $this->successResponse('OTP perubahan nomor HP telah dikirim.', $this->otpPayload($otp));
    }

    public function confirmPhoneChange(Request $request): JsonResponse
    {
        $data = $request->validate([
            'otp_code' => 'required|string|size:6',
            'new_phone' => 'required|string|regex:/^08[0-9]{8,11}$/|unique:users,phone_number',
        ]);

        $user = $request->user();
        $oldPhone = $user->phone_number;
        $this->otpService->verify($user->email, $data['otp_code'], 'change_phone', 'email', $user->id);
        $user->forceFill(['phone_number' => $data['new_phone']])->save();
        $this->audit($user, 'phone_changed', [
            'old_value' => $oldPhone,
            'new_value' => $data['new_phone'],
        ]);

        return $this->successResponse('Nomor HP berhasil diperbarui.');
    }

    protected function assertPasswordAndPin(User $user, string $password, string $pin): void
    {
        if (!Hash::check($password, $user->password)) {
            throw ValidationException::withMessages(['password' => ['Password tidak valid.']]);
        }
        if (!$user->transaction_pin || !Hash::check($pin, $user->transaction_pin)) {
            throw ValidationException::withMessages(['pin' => ['PIN tidak valid.']]);
        }
    }

    protected function assertStrongPin(string $pin): void
    {
        $blocked = ['123456', '111111', '222222', '654321', '000000'];
        if (in_array($pin, $blocked, true)) {
            throw ValidationException::withMessages(['pin' => ['PIN terlalu lemah.']]);
        }

        if (preg_match('/^(\d)\1{5}$/', $pin)) {
            throw ValidationException::withMessages(['pin' => ['PIN tidak boleh semua digit sama.']]);
        }

        if ($pin === '012345' || $pin === '123456' || $pin === '234567' || $pin === '345678' || $pin === '456789' || $pin === '567890' || $pin === '987654' || $pin === '876543') {
            throw ValidationException::withMessages(['pin' => ['PIN tidak boleh berurutan.']]);
        }
    }

    protected function revokeOtherSessions(User $user, Request $request): void
    {
        $currentTokenId = $user->currentAccessToken()?->id;
        $user->tokens()->when($currentTokenId, fn ($q) => $q->where('id', '!=', $currentTokenId))->delete();
        UserDevice::query()
            ->where('user_id', $user->id)
            ->where('device_uuid', '!=', $request->header('X-Device-UUID'))
            ->update(['is_active' => false]);
    }

    protected function audit(User $user, string $activity, array $payload = []): void
    {
        ActivityLog::create([
            'user_id' => $user->id,
            'activity' => $activity,
            'payload' => array_merge([
                'ip' => request()->ip(),
                'user_agent' => substr((string) request()->userAgent(), 0, 512),
                'device' => request()->header('X-Device-UUID'),
                'timestamp' => now()->toIso8601String(),
            ], $payload),
        ]);
    }

    protected function otpPayload($otp): array
    {
        $payload = [
            'expires_at' => $otp->expires_at?->toIso8601String(),
            'resend_available_at' => $otp->resend_available_at?->toIso8601String(),
            'max_attempts' => (int) $otp->max_attempts,
        ];

        if (app()->environment('local', 'testing')) {
            $payload['dummy_sent_code'] = $otp->code;
        }

        return $payload;
    }

    protected function maskValue(string $value): string
    {
        if (str_contains($value, '@')) {
            [$left, $right] = explode('@', $value, 2);
            return substr($left, 0, 2) . '***@' . $right;
        }

        return substr($value, 0, 2) . '***';
    }
}
