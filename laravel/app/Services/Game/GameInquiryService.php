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
 * Real VIP Payment game nickname inquiry (optional UX lookup).
 * Inquiry does not debit wallet or place an order.
 *
 * Digi purchase path: Digi schema → customer_no → PIN → CreateTransaction (no VIP session required).
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
     * @return array{brand:string,sku:?string,code:string,label:string,delivery:string,fields:list<array{key:string,label:string,required:bool}>}
     */
    public function accountSchema(string $brand, ?string $skuCode = null): array
    {
        $sku = trim((string) $skuCode);
        $resolved = $this->resolver->resolveForProduct($brand, $sku !== '' ? $sku : null);

        return [
            'brand' => trim($brand),
            'sku' => $sku !== '' ? $sku : null,
            'code' => $resolved['code'],
            'label' => $resolved['label'],
            'delivery' => $resolved['delivery'],
            'fields' => $resolved['fields'],
        ];
    }

    /**
     * Optional VIP get-nickname lookup for UX/review.
     * Digi purchase must NOT depend on this — use GameTargetBuilder + CreateTransactionAction.
     * When VIP is unavailable or lookup fails, still returns customer_no from Digi schema
     * with nickname=null and found=false (purchase may continue).
     *
     * @param  array<string, mixed>  $account
     * @return array<string, mixed>
     */
    public function inquire(User $user, string $skuCode, array $account): array
    {
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

        if ($this->resolver->isNonPurchaseSku($product->sku_code)) {
            throw ValidationException::withMessages([
                'sku_code' => ['Produk ini bukan produk top-up. Pembelian tidak tersedia.'],
            ]);
        }

        $brand = trim((string) ($product->provider?->name ?? ''));
        if ($brand === '') {
            $brand = 'Game';
        }

        $resolved = $this->resolver->resolveForProduct($brand, $product->sku_code);
        if (($resolved['delivery'] ?? '') !== 'account' || ($resolved['fields'] ?? []) === []) {
            throw ValidationException::withMessages([
                'sku_code' => ['Format akun untuk produk ini belum tersedia. Pembelian tidak dapat dilanjutkan.'],
            ]);
        }

        $builder = app(GameTargetBuilder::class);
        $parsed = $builder->parseAccountFields($resolved['fields'], $account);
        $target = $parsed['target'];
        $zone = $parsed['zone'];
        $customerNo = $builder->composeCustomerNo($target, $zone);

        $pricing = $this->pricing->calculateForProduct($product);
        $sellPrice = (float) ($pricing['sell_price'] ?? $product->sell_price);
        $adminFee = (float) ($pricing['admin_fee'] ?? 0);
        $total = $sellPrice + $adminFee;
        $idZoneLabel = $zone !== null && $zone !== ''
            ? $target.' ('.$zone.')'
            : $target;

        $nickname = '';
        $inquiryRef = null;
        $found = false;

        // Optional VIP nickname — never blocks Digi purchase path.
        if ($this->vip->isConfigured()) {
            try {
                $response = $this->vip->getNickname($resolved['code'], $target, $zone);
                if (! empty($response['success'])) {
                    $nickname = $this->extractNickname($response);
                    if ($nickname !== '') {
                        $found = true;
                        $inquiryRef = 'GNI'.Str::upper(Str::random(18));
                        $this->storeSession($user->id, $customerNo, [
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
                            'id_zone_label' => $idZoneLabel,
                        ]);
                    }
                }
            } catch (\Throwable) {
                // Ignore VIP lookup failures — Digi purchase continues without nickname.
            }
        }

        return [
            'inquiry_ref_id' => $inquiryRef,
            'sku_code' => $product->sku_code,
            'product_name' => $product->name,
            'game' => $resolved['label'],
            'brand' => $brand,
            'user_id' => $target,
            'zone_id' => $zone,
            'customer_no' => $customerNo,
            'id_zone_label' => $idZoneLabel,
            'nickname' => $nickname !== '' ? $nickname : null,
            'item' => $product->name,
            'price' => $total,
            'sell_price' => $sellPrice,
            'admin_fee' => $adminFee,
            'found' => $found,
            'nickname_optional' => true,
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
