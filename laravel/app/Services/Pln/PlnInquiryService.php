<?php

namespace App\Services\Pln;

use App\Models\User;
use App\Services\DigiflazzService;
use App\Services\ProductProviders\DigiflazzResponseCodeClassifier;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

/**
 * Real Digiflazz prepaid PLN meter inquiry (/inquiry-pln).
 * Inquiry only — does not debit wallet or purchase token.
 *
 * Status is the primary success/failure indicator; Digiflazz RC classifies the outcome
 * when present (DigiflazzResponseCodeClassifier). Field `name` is optional per Digiflazz docs.
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
        if (! $this->digiflazz->isConfigured()) {
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
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            Log::warning('Digiflazz PLN inquiry: connection failure', ['message' => $e->getMessage()]);
            throw ValidationException::withMessages([
                'inquiry' => ['Gagal menghubungi provider. Silakan coba lagi.'],
            ]);
        } catch (\Throwable $e) {
            // DigiflazzService::postRequest() throws a plain Exception for non-2xx HTTP
            // responses, embedding the raw JSON body in the message. Try to recover the
            // real Digiflazz reason instead of always showing a generic sentence.
            $decoded = $this->tryExtractBodyFromExceptionMessage($e->getMessage());
            Log::warning('Digiflazz PLN inquiry: non-2xx response', [
                'raw_message' => $e->getMessage(),
                'decoded' => $decoded,
            ]);
            if (is_array($decoded['data'] ?? null)) {
                $rc = DigiflazzResponseCodeClassifier::normalize($decoded['data']['rc'] ?? null);
                $classifier = $rc !== null ? DigiflazzResponseCodeClassifier::classify($rc) : null;
                throw ValidationException::withMessages([
                    'inquiry' => [$this->resolveFailureUserMessage($decoded['data'], $classifier)],
                ]);
            }
            throw ValidationException::withMessages([
                'inquiry' => ['Gagal menghubungi provider. Silakan coba lagi.'],
            ]);
        }

        $data = $response['data'] ?? null;
        if (! is_array($data)) {
            throw ValidationException::withMessages([
                'inquiry' => ['Respons inquiry PLN tidak valid.'],
            ]);
        }

        $status = strtolower(trim((string) ($data['status'] ?? '')));
        $rc = DigiflazzResponseCodeClassifier::normalize($data['rc'] ?? null);
        $classifier = $rc !== null
            ? DigiflazzResponseCodeClassifier::classify($rc)
            : null;

        Log::info('Digiflazz PLN inquiry classified', array_merge(
            [
                'customer_no' => $customerNo,
                'status' => $status !== '' ? $status : null,
            ],
            $classifier?->toLogContext() ?? [
                'rc' => null,
                'category' => null,
            ]
        ));

        // Status remains the primary success/failure indicator.
        $isSuccess = in_array($status, ['sukses', 'success'], true);
        if (! $isSuccess) {
            throw ValidationException::withMessages([
                'inquiry' => [$this->resolveFailureUserMessage($data, $classifier)],
            ]);
        }

        $resolvedCustomerNo = trim((string) ($data['customer_no'] ?? ''));
        if ($resolvedCustomerNo === '') {
            $resolvedCustomerNo = $customerNo;
        }
        if ($resolvedCustomerNo === '') {
            throw ValidationException::withMessages([
                'inquiry' => ['Nomor pelanggan tidak tersedia dari provider.'],
            ]);
        }

        // Digiflazz docs: `name` is optional — do not fail when absent.
        $name = trim((string) ($data['name'] ?? ''));

        $normalized = [
            'customer_no' => $resolvedCustomerNo,
            'meter_no' => trim((string) ($data['meter_no'] ?? '')),
            'subscriber_id' => trim((string) ($data['subscriber_id'] ?? '')),
            'customer_name' => $name,
            'segment_power' => trim((string) ($data['segment_power'] ?? '')),
            'rc' => $rc,
            'rc_category' => $classifier?->category,
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
     * DigiflazzService::postRequest() encodes non-2xx bodies into the exception
     * message as 'Digiflazz API error (STATUS): {json}'. Best-effort recovery of
     * that JSON so the real provider message can still reach the user.
     *
     * @return array<string, mixed>
     */
    protected function tryExtractBodyFromExceptionMessage(string $message): array
    {
        $pos = strpos($message, '): ');
        if ($pos === false) {
            return [];
        }
        $json = substr($message, $pos + 3);
        $decoded = json_decode($json, true);

        return is_array($decoded) ? $decoded : [];
    }

    /**
     * User-facing failure message: prefer Digiflazz `message`, then RC description, then raw rc / default.
     *
     * @param  array<string, mixed>  $data
     */
    protected function resolveFailureUserMessage(array $data, ?DigiflazzResponseCodeClassifier $classifier): string
    {
        $message = trim((string) ($data['message'] ?? ''));
        if ($message !== '') {
            return $message;
        }

        if ($classifier !== null) {
            $description = trim($classifier->description());
            if ($description !== '' && ! $classifier->isUnknown()) {
                return $description;
            }
        }

        $rcRaw = trim((string) ($data['rc'] ?? ''));
        if ($rcRaw !== '') {
            return 'Inquiry meter gagal (RC '.$rcRaw.').';
        }

        return 'Inquiry meter gagal.';
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
