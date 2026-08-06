<?php

namespace App\Services\Pln;

use App\Models\User;
use App\Services\DigiflazzService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\ValidationException;

/**
 * Real Digiflazz prepaid PLN meter inquiry (/inquiry-pln).
 * Inquiry only — does not debit wallet or purchase token.
 */
class PlnInquiryService
{
    public const CACHE_TTL_MINUTES = 30;

    public function __construct(
        protected DigiflazzService $digiflazz,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function inquire(User $user, string $customerNo): array
    {
        if (!$this->digiflazz->isConfigured()) {
            throw ValidationException::withMessages([
                'provider' => ['Layanan inquiry PLN belum dikonfigurasi.'],
            ]);
        }

        $customerNo = preg_replace('/\D/', '', $customerNo) ?? '';
        if (strlen($customerNo) < 11 || strlen($customerNo) > 12) {
            throw ValidationException::withMessages([
                'customer_no' => ['Nomor meter / ID pelanggan PLN harus 11–12 digit angka.'],
            ]);
        }

        try {
            $response = $this->digiflazz->inquiryPln($customerNo);
        } catch (\Throwable $e) {
            throw ValidationException::withMessages([
                'inquiry' => ['Gagal menghubungi provider. Silakan coba lagi.'],
            ]);
        }

        $data = $response['data'] ?? null;
        if (!is_array($data)) {
            throw ValidationException::withMessages([
                'inquiry' => ['Respons inquiry PLN tidak valid.'],
            ]);
        }

        $status = strtolower((string) ($data['status'] ?? ''));
        if (!in_array($status, ['sukses', 'success'], true)) {
            $message = trim((string) ($data['message'] ?? $data['rc'] ?? 'Inquiry meter gagal.'));
            throw ValidationException::withMessages([
                'inquiry' => [$message !== '' ? $message : 'Inquiry meter gagal.'],
            ]);
        }

        $name = trim((string) ($data['name'] ?? ''));
        if ($name === '') {
            throw ValidationException::withMessages([
                'inquiry' => ['Nama pelanggan tidak tersedia dari provider.'],
            ]);
        }

        $normalized = [
            'customer_no' => (string) ($data['customer_no'] ?? $customerNo),
            'meter_no' => trim((string) ($data['meter_no'] ?? '')),
            'subscriber_id' => trim((string) ($data['subscriber_id'] ?? '')),
            'customer_name' => $name,
            'segment_power' => trim((string) ($data['segment_power'] ?? '')),
            'raw' => $data,
        ];

        $this->storeSession($user->id, $normalized['customer_no'], $normalized);

        return [
            'customer_no' => $normalized['customer_no'],
            'meter_no' => $normalized['meter_no'] !== '' ? $normalized['meter_no'] : $normalized['customer_no'],
            'subscriber_id' => $normalized['subscriber_id'],
            'customer_name' => $normalized['customer_name'],
            'segment_power' => $normalized['segment_power'],
            'expires_in_seconds' => self::CACHE_TTL_MINUTES * 60,
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    public function getSession(int $userId, string $customerNo): ?array
    {
        $customerNo = preg_replace('/\D/', '', $customerNo) ?? '';
        $payload = Cache::get($this->cacheKey($userId, $customerNo));

        return is_array($payload) ? $payload : null;
    }

    public function forgetSession(int $userId, string $customerNo): void
    {
        $customerNo = preg_replace('/\D/', '', $customerNo) ?? '';
        Cache::forget($this->cacheKey($userId, $customerNo));
    }

    protected function cacheKey(int $userId, string $customerNo): string
    {
        return "pln_inquiry:{$userId}:{$customerNo}";
    }

    /**
     * @param  array<string, mixed>  $session
     */
    protected function storeSession(int $userId, string $customerNo, array $session): void
    {
        Cache::put(
            $this->cacheKey($userId, $customerNo),
            $session,
            now()->addMinutes(self::CACHE_TTL_MINUTES)
        );
    }
}
