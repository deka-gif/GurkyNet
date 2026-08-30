<?php

namespace App\Services\Security;

use App\Models\ActivityLog;
use App\Models\OtpCode;
use App\Models\User;
use App\Services\Notifications\WhatsappOtpService;
use App\Services\OtpMailService;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class OtpService
{
    public function __construct(
        protected OtpMailService $otpMailService,
        protected WhatsappOtpService $whatsappOtpService,
    ) {}

    public function issue(
        string $identifier,
        string $action,
        string $channel = 'email',
        ?User $user = null,
        array $meta = [],
        int $expiryMinutes = 5,
        int $resendCooldownSeconds = 60,
        int $maxAttempts = 5,
        ?array $deliveryOverride = null,
    ): OtpCode {
        if ($deliveryOverride !== null) {
            $meta['delivery_override'] = $deliveryOverride;
        }

        $latestActive = OtpCode::query()
            ->where('phone_number', $identifier)
            ->where('action', $action)
            ->where('channel', $channel)
            ->where('is_used', false)
            ->latest()
            ->first();

        if ($latestActive?->resend_available_at && now()->lt($latestActive->resend_available_at)) {
            throw ValidationException::withMessages([
                'otp' => ['Tunggu beberapa saat sebelum meminta OTP baru.'],
            ]);
        }

        OtpCode::query()
            ->where('phone_number', $identifier)
            ->where('action', $action)
            ->where('channel', $channel)
            ->where('is_used', false)
            ->update(['is_used' => true]);

        $code = str_pad((string) mt_rand(100000, 999999), 6, '0', STR_PAD_LEFT);

        $otp = OtpCode::create([
            'user_id' => $user?->id,
            'phone_number' => $identifier,
            'code' => $code,
            'action' => $action,
            'channel' => $channel,
            'is_used' => false,
            'attempt_count' => 0,
            'max_attempts' => $maxAttempts,
            'expires_at' => now()->addMinutes($expiryMinutes),
            'resend_available_at' => now()->addSeconds($resendCooldownSeconds),
            'meta' => $meta,
        ]);

        try {
            $this->deliver($otp, $expiryMinutes);
        } catch (RuntimeException $e) {
            $otp->delete();

            throw ValidationException::withMessages([
                'otp' => [$e->getMessage()],
            ]);
        }

        $this->audit($user?->id, 'otp_sent', [
            'identifier' => $identifier,
            'channel' => $channel,
            'action' => $action,
        ]);

        return $otp;
    }

    public function verify(string $identifier, string $code, string $action, string $channel = 'email', ?int $userId = null): OtpCode
    {
        $otp = OtpCode::query()
            ->where('phone_number', $identifier)
            ->where('action', $action)
            ->where('channel', $channel)
            ->where('is_used', false)
            ->latest()
            ->first();

        if (!$otp) {
            throw ValidationException::withMessages([
                'otp' => ['Kode OTP tidak ditemukan atau sudah digunakan.'],
            ]);
        }

        if ($otp->expires_at->isPast()) {
            $otp->update(['is_used' => true]);
            throw ValidationException::withMessages([
                'otp' => ['Kode OTP sudah kedaluwarsa.'],
            ]);
        }

        if ((int) $otp->attempt_count >= (int) $otp->max_attempts) {
            $otp->update(['is_used' => true]);
            throw ValidationException::withMessages([
                'otp' => ['Percobaan OTP melebihi batas maksimum.'],
            ]);
        }

        if (!hash_equals((string) $otp->code, (string) $code)) {
            $otp->increment('attempt_count');
            throw ValidationException::withMessages([
                'otp' => ['Kode OTP tidak valid.'],
            ]);
        }

        $otp->update([
            'is_used' => true,
            'attempt_count' => $otp->attempt_count + 1,
        ]);

        $this->audit($userId ?? $otp->user_id, 'otp_verified', [
            'identifier' => $identifier,
            'channel' => $channel,
            'action' => $action,
        ]);

        return $otp;
    }

    protected function deliver(OtpCode $otp, int $expiryMinutes): void
    {
        if (($otp->meta['delivery_override']['via'] ?? null) === 'whatsapp') {
            $this->whatsappOtpService->send(
                (string) $otp->meta['delivery_override']['phone'],
                $otp->code,
                $expiryMinutes
            );
            return;
        }

        if ($otp->channel === 'email') {
            $this->otpMailService->sendOtp($otp->phone_number, $otp->code, $otp->action, $expiryMinutes);
            return;
        }

        Log::info('OTP PHONE DELIVERY (sandbox)', [
            'identifier' => $otp->phone_number,
            'action' => $otp->action,
        ]);
    }

    protected function audit(?int $userId, string $activity, array $payload): void
    {
        ActivityLog::create([
            'user_id' => $userId,
            'activity' => $activity,
            'payload' => array_merge($payload, [
                'ip' => request()->ip(),
                'user_agent' => substr((string) request()->userAgent(), 0, 512),
                'device' => request()->header('X-Device-UUID'),
                'timestamp' => now()->toIso8601String(),
            ]),
        ]);
    }
}
