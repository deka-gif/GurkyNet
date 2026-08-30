<?php

namespace App\Services\Notifications;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class WhatsappOtpService
{
    public function send(string $phoneNumber, string $code, int $expiryMinutes): void
    {
        $baseUrl = config('services.whatsapp_otp.base_url');
        $apiKey = config('services.whatsapp_otp.api_key');
        $sender = config('services.whatsapp_otp.sender_name', 'GurkyNet');

        if (!$baseUrl || !$apiKey) {
            throw new RuntimeException('Pengiriman OTP via WhatsApp belum tersedia saat ini. Gunakan OTP email.');
        }

        $message = "Kode OTP {$sender} Anda: {$code}. Berlaku {$expiryMinutes} menit. Jangan bagikan kode ini kepada siapa pun.";

        try {
            $response = Http::withHeaders(['Authorization' => $apiKey])
                ->asForm()
                ->post($baseUrl, [
                    'target' => $phoneNumber,
                    'message' => $message,
                ]);

            if (!$response->successful()) {
                Log::error('WhatsApp OTP gateway error', ['status' => $response->status(), 'body' => $response->body()]);
                throw new RuntimeException('Gagal mengirim OTP via WhatsApp, coba lagi atau gunakan email.');
            }
        } catch (RuntimeException $e) {
            throw $e;
        } catch (\Throwable $e) {
            Log::error('WhatsApp OTP gateway exception', ['error' => $e->getMessage()]);
            throw new RuntimeException('Gagal mengirim OTP via WhatsApp, coba lagi atau gunakan email.');
        }
    }
}
