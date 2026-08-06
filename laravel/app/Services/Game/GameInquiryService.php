<?php

namespace App\Services\Game;

use App\Models\User;
use App\Services\AvailabilityService;
use App\Services\PricingService;
use App\Services\ProductProviders\ProductProviderSelectionService;
use App\Services\VipService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Real VIP Payment game nickname inquiry (game-feature type=get-nickname).
 * Inquiry only — does not debit wallet or place an order.
 */
class GameInquiryService
{
    public const CACHE_TTL_MINUTES = 20;

    public function __construct(
        protected VipService $vip,
        protected GameNicknameResolver $resolver,
        protected ProductProviderSelectionService $selection,
        protected AvailabilityService $availability,
        protected PricingService $pricing,
    ) {}

    /**
     * @return array{brand:string,code:string,label:string,fields:list<array{key:string,label:string,required:bool}>}
     */
    public function accountSchema(string $brand): array
    {
        $resolved = $this->resolver->resolve($brand);

        return [
            'brand' => trim($brand),
            'code' => $resolved['code'],
            'label' => $resolved['label'],
            'fields' => $resolved['fields'],
        ];
    }

    /**
     * @param  array<string, mixed>  $account
     * @return array<string, mixed>
     */
    public function inquire(User $user, string $skuCode, array $account): array
    {
        if (!$this->vip->isConfigured()) {
            throw ValidationException::withMessages([
                'provider' => ['Layanan validasi game (VIP Payment) belum dikonfigurasi.'],
            ]);
        }

        $product = $this->selection->findProductByInternalSku($skuCode);
        if (!$product) {
            throw ValidationException::withMessages([
                'sku_code' => ['Produk tidak ditemukan.'],
            ]);
        }
        $product->loadMissing(['provider', 'category']);

        if (!$this->availability->isAvailable($product)) {
            throw ValidationException::withMessages([
                'sku_code' => ['Produk sedang tidak tersedia.'],
            ]);
        }

        $brand = trim((string) ($product->provider?->name ?? ''));
        if ($brand === '') {
            $brand = 'Game';
        }

        $resolved = $this->resolver->resolve($brand);
        $parsed = $this->parseAccountFields($resolved['fields'], $account);
        $target = $parsed['target'];
        $zone = $parsed['zone'];
        $customerNo = $this->buildCustomerNo($target, $zone);

        try {
            $response = $this->vip->getNickname($resolved['code'], $target, $zone);
        } catch (\Throwable $e) {
            throw ValidationException::withMessages([
                'inquiry' => ['Gagal menghubungi provider. Silakan coba lagi.'],
            ]);
        }

        if (empty($response['success'])) {
            $message = trim((string) ($response['message'] ?? ''));
            if ($message === '') {
                $message = 'Player ID Tidak Ditemukan. Periksa kembali data akun Anda.';
            }
            throw ValidationException::withMessages([
                'inquiry' => [$message],
            ]);
        }

        $nickname = $this->extractNickname($response);
        if ($nickname === '') {
            throw ValidationException::withMessages([
                'inquiry' => ['Player ID Tidak Ditemukan. Periksa kembali data akun Anda.'],
            ]);
        }

        $pricing = $this->pricing->calculateForProduct($product);
        $sellPrice = (float) ($pricing['sell_price'] ?? $product->sell_price);
        $adminFee = (float) ($pricing['admin_fee'] ?? 0);
        $total = $sellPrice + $adminFee;

        $inquiryRef = 'GNI' . Str::upper(Str::random(18));
        $session = [
            'inquiry_ref_id' => $inquiryRef,
            'sku_code' => $product->sku_code,
            'product_name' => $product->name,
            'brand' => $brand,
            'game_label' => $resolved['label'],
            'nickname_code' => $resolved['code'],
            'user_id' => $target,
            'zone_id' => $zone,
            'customer_no' => $customerNo,
            'nickname' => $nickname,
            'sell_price' => $sellPrice,
            'admin_fee' => $adminFee,
            'total_payment' => $total,
            'id_zone_label' => $zone !== null && $zone !== ''
                ? $target . ' (' . $zone . ')'
                : $target,
        ];

        $this->storeSession($user->id, $customerNo, $session);

        return [
            'inquiry_ref_id' => $inquiryRef,
            'sku_code' => $product->sku_code,
            'product_name' => $product->name,
            'game' => $resolved['label'],
            'brand' => $brand,
            'user_id' => $target,
            'zone_id' => $zone,
            'customer_no' => $customerNo,
            'id_zone_label' => $session['id_zone_label'],
            'nickname' => $nickname,
            'item' => $product->name,
            'price' => $total,
            'sell_price' => $sellPrice,
            'admin_fee' => $adminFee,
            'found' => true,
            'expires_in_seconds' => self::CACHE_TTL_MINUTES * 60,
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    public function getSession(int $userId, string $customerNo): ?array
    {
        $payload = Cache::get($this->cacheKey($userId, $this->normalizeTargetKey($customerNo)));

        return is_array($payload) ? $payload : null;
    }

    public function forgetSession(int $userId, string $customerNo): void
    {
        Cache::forget($this->cacheKey($userId, $this->normalizeTargetKey($customerNo)));
    }

    /**
     * @param  list<array{key:string,label:string,required:bool}>  $fields
     * @param  array<string, mixed>  $account
     * @return array{target:string,zone:?string,values:array<string,string>}
     */
    protected function parseAccountFields(array $fields, array $account): array
    {
        $values = [];
        foreach ($fields as $field) {
            $key = $field['key'];
            $raw = $account[$key] ?? null;
            $value = is_scalar($raw) ? trim((string) $raw) : '';
            if ($field['required'] && $value === '') {
                throw ValidationException::withMessages([
                    'account.' . $key => [$field['label'] . ' wajib diisi.'],
                ]);
            }
            if ($value !== '') {
                $values[$key] = $value;
            }
        }

        $target = $values['user_id']
            ?? $values['player_id']
            ?? $values['uid']
            ?? null;
        if ($target === null || $target === '') {
            // First required field as primary target
            foreach ($fields as $field) {
                if (!empty($values[$field['key']])) {
                    $target = $values[$field['key']];
                    break;
                }
            }
        }

        if ($target === null || $target === '') {
            throw ValidationException::withMessages([
                'account' => ['Data akun game wajib diisi.'],
            ]);
        }

        $zone = $values['zone_id'] ?? $values['server_id'] ?? null;

        return [
            'target' => $target,
            'zone' => $zone !== null && $zone !== '' ? $zone : null,
            'values' => $values,
        ];
    }

    protected function buildCustomerNo(string $target, ?string $zone): string
    {
        if ($zone !== null && $zone !== '') {
            return $target . '|' . $zone;
        }

        return $target;
    }

    /**
     * @param  array<string, mixed>  $response
     */
    protected function extractNickname(array $response): string
    {
        $raw = $response['raw'] ?? [];
        $data = is_array($raw) ? ($raw['data'] ?? null) : null;

        if (is_string($data)) {
            return trim($data);
        }
        if (is_array($data)) {
            foreach (['nickname', 'nick', 'username', 'name', 'ign'] as $key) {
                if (!empty($data[$key]) && is_scalar($data[$key])) {
                    return trim((string) $data[$key]);
                }
            }
        }

        return '';
    }

    protected function normalizeTargetKey(string $customerNo): string
    {
        return trim($customerNo);
    }

    protected function cacheKey(int $userId, string $customerNo): string
    {
        return 'game_inquiry:' . $userId . ':' . sha1($customerNo);
    }

    /**
     * @param  array<string, mixed>  $session
     */
    protected function storeSession(int $userId, string $customerNo, array $session): void
    {
        Cache::put(
            $this->cacheKey($userId, $this->normalizeTargetKey($customerNo)),
            $session,
            now()->addMinutes(self::CACHE_TTL_MINUTES)
        );
    }
}
