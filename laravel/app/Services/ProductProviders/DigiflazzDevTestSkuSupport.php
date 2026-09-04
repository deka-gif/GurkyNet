<?php

namespace App\Services\ProductProviders;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductProvider;
use Illuminate\Validation\ValidationException;

/**
 * Minimal Digiflazz Development Test Case support (official prepaid SKU xld10).
 *
 * Active only when DIGIFLAZZ_TESTING is truthy. Never persists catalog rows.
 * Digiflazz-only routing is enforced by ProductProviderFulfillmentService for this SKU.
 */
class DigiflazzDevTestSkuSupport
{
    public const SKU = 'xld10';

    /** @var list<string> */
    public const ALLOWLIST = [self::SKU];

    /**
     * Whether Digiflazz Development testing mode is enabled (same flag as DigiflazzService buy()).
     */
    public function testingEnabled(): bool
    {
        return $this->isTruthyFlag(config('services.digiflazz.testing'));
    }

    public function isAllowlisted(string $skuCode): bool
    {
        return in_array(strtolower(trim($skuCode)), self::ALLOWLIST, true);
    }

    /**
     * Purchase / resolve gate: testing ON + allowlisted SKU.
     */
    public function isActiveForSku(string $skuCode): bool
    {
        return $this->testingEnabled() && $this->isAllowlisted($skuCode);
    }

    /**
     * Customer hold/sell amount for the virtual test SKU.
     * Fail-closed: must be configured and > 0 (never invent Digiflazz pricelist prices).
     *
     * @throws ValidationException
     */
    public function requireCustomerPrice(): float
    {
        $raw = config('services.digiflazz.dev_test_price');
        if ($raw === null || $raw === '') {
            throw ValidationException::withMessages([
                'product_code' => ['Harga test Digiflazz Development belum dikonfigurasi (DIGIFLAZZ_DEV_TEST_PRICE).'],
            ]);
        }

        if (! is_numeric($raw)) {
            throw ValidationException::withMessages([
                'product_code' => ['Harga test Digiflazz Development tidak valid.'],
            ]);
        }

        $price = (float) $raw;
        if ($price <= 0) {
            throw ValidationException::withMessages([
                'product_code' => ['Harga test Digiflazz Development harus lebih dari 0.'],
            ]);
        }

        return $price;
    }

    /**
     * Resolve an unsaved virtual Product for allowlisted SKU when testing is ON.
     * Returns null when inactive (does not throw on missing price — fulfill path still needs the SKU).
     */
    public function resolveVirtualProduct(string $skuCode): ?Product
    {
        if (! $this->isActiveForSku($skuCode)) {
            return null;
        }

        $raw = config('services.digiflazz.dev_test_price');
        $price = is_numeric($raw) ? (float) $raw : 0.0;
        if ($price < 0) {
            $price = 0.0;
        }

        return $this->makeVirtualProduct(self::SKU, $price);
    }

    /**
     * Build an unsaved Product used only for Digiflazz Development test checkout/fulfill.
     * Empty providerSkus → ProductRoutingService synthetic Digiflazz offer (Digi-only).
     */
    public function makeVirtualProduct(string $skuCode, float $customerPrice): Product
    {
        $sku = strtolower(trim($skuCode));
        $product = new Product([
            'sku_code' => $sku,
            'name' => 'Digiflazz Development Test',
            'base_price' => $customerPrice,
            'sell_price' => $customerPrice,
            'admin_fee' => 0,
            'status' => true,
            'ops_status' => 'active',
        ]);

        $category = new ProductCategory([
            'name' => 'Development Test',
            'slug' => 'digiflazz-dev-test',
            'icon' => 'box',
        ]);
        $product->setRelation('category', $category);
        $product->setRelation('provider', null);
        $product->setRelation('providerSkus', collect());

        $digi = ProductProvider::digiflazz();
        if ($digi) {
            $product->product_provider_id = $digi->id;
            $product->setRelation('productProvider', $digi);
        }

        return $product;
    }

    public function isUnsavedVirtualProduct(?Product $product): bool
    {
        if (! $product instanceof Product) {
            return false;
        }

        return ! $product->exists && $this->isAllowlisted((string) $product->sku_code);
    }

    protected function isTruthyFlag(mixed $value): bool
    {
        if ($value === null || $value === '') {
            return false;
        }

        if (is_bool($value)) {
            return $value;
        }

        $normalized = strtolower(trim((string) $value));

        return in_array($normalized, ['1', 'true', 'yes', 'on'], true);
    }
}
