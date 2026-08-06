<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

class OtpMailService
{
    public function sendOtp(string $email, string $otp, string $purpose, int $expiryMinutes = 5): void
    {
        $apiKey = (string) config('services.resend.key');
        if ($this->runningAutomatedTests()) {
            Log::info('OTP EMAIL SENT', [
                'email' => $email,
                'purpose' => $purpose,
                'timestamp' => now()->toIso8601String(),
                'response' => ['mode' => 'testing_stub'],
            ]);

            return;
        }

        if ($apiKey === '') {
            throw new RuntimeException('Resend API key is not configured.');
        }

        $fromAddress = (string) config('mail.from.address', 'onboarding@resend.dev');
        $fromName = (string) config('mail.from.name', 'GurkyNet');

        try {
            $resend = \Resend::client($apiKey);
            $response = $resend->emails->send([
                'from' => sprintf('%s <%s>', $fromName, $fromAddress),
                'to' => [$email],
                'subject' => 'Kode Verifikasi OTP',
                'html' => $this->buildHtml($otp, $expiryMinutes),
            ]);

            Log::info('OTP EMAIL SENT', [
                'email' => $email,
                'purpose' => $purpose,
                'timestamp' => now()->toIso8601String(),
                'response' => method_exists($response, 'toArray') ? $response->toArray() : null,
            ]);
        } catch (Throwable $e) {
            Log::error('OTP EMAIL FAILED', [
                'email' => $email,
                'purpose' => $purpose,
                'exception' => $e->getMessage(),
                'response' => method_exists($e, 'getResponse') ? $e->getResponse() : null,
                'timestamp' => now()->toIso8601String(),
            ]);

            throw new RuntimeException('Kami gagal mengirim kode OTP. Silakan coba beberapa saat lagi.');
        }
    }

    protected function buildHtml(string $otp, int $expiryMinutes): string
    {
        $year = now()->year;

        return <<<HTML
<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kode Verifikasi OTP</title>
  </head>
  <body style="margin:0;padding:0;background:#0f172a;font-family:Arial,Helvetica,sans-serif;color:#e2e8f0;">
    <div style="padding:24px 12px;background:linear-gradient(180deg,#0f172a 0%,#111827 100%);">
      <div style="max-width:620px;margin:0 auto;background:#111827;border:1px solid #1f2937;border-radius:24px;overflow:hidden;box-shadow:0 20px 50px rgba(15,23,42,0.35);">
        <div style="padding:28px 28px 20px;border-bottom:1px solid #1f2937;background:linear-gradient(135deg,#111827 0%,#1e293b 100%);">
          <div style="display:inline-flex;align-items:center;gap:12px;">
            <div style="width:44px;height:44px;border-radius:14px;background:#2563eb;color:#ffffff;font-weight:800;font-size:22px;line-height:44px;text-align:center;">G</div>
            <div>
              <div style="font-size:20px;font-weight:800;color:#ffffff;">GurkyNet</div>
              <div style="font-size:12px;color:#94a3b8;">Secure account verification</div>
            </div>
          </div>
        </div>
        <div style="padding:32px 28px;">
          <div style="font-size:28px;font-weight:800;color:#ffffff;margin-bottom:10px;">Kode Verifikasi OTP</div>
          <div style="font-size:15px;line-height:1.7;color:#cbd5e1;margin-bottom:24px;">
            Gunakan kode berikut untuk melanjutkan proses verifikasi akun Anda.
          </div>
          <div style="margin:0 0 24px;padding:20px;border-radius:20px;background:#0b1220;border:1px solid #334155;text-align:center;">
            <div style="font-size:14px;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;margin-bottom:10px;">Kode OTP Anda</div>
            <div style="font-size:40px;font-weight:800;letter-spacing:0.28em;color:#60a5fa;">{$otp}</div>
          </div>
          <div style="padding:16px 18px;border-radius:16px;background:#172033;border:1px solid #25324b;color:#cbd5e1;font-size:14px;line-height:1.7;">
            Kode berlaku selama {$expiryMinutes} menit.
          </div>
          <div style="margin-top:20px;padding:16px 18px;border-radius:16px;background:#2a1414;border:1px solid #7f1d1d;color:#fecaca;font-size:14px;line-height:1.7;">
            Jangan pernah memberikan kode OTP kepada siapa pun.<br>
            Tim GurkyNet tidak akan pernah meminta OTP Anda.
          </div>
        </div>
        <div style="padding:18px 28px;border-top:1px solid #1f2937;color:#94a3b8;font-size:12px;text-align:center;background:#0f172a;">
          &copy; {$year} GurkyNet Digital Nusantara
        </div>
      </div>
    </div>
  </body>
</html>
HTML;
    }

    protected function runningAutomatedTests(): bool
    {
        if (app()->runningUnitTests() || app()->environment('testing')) {
            return true;
        }

        if (!app()->runningInConsole()) {
            return false;
        }

        $argv = implode(' ', $_SERVER['argv'] ?? []);

        return str_contains($argv, 'phpunit') || str_contains($argv, ' artisan test');
    }
}
