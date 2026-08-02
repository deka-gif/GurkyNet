<?php

namespace App\Repositories\Eloquent;

use App\Models\Provider;
use App\Repositories\Contracts\ProviderRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;

class ProviderRepository implements ProviderRepositoryInterface
{
    public function allActive(): Collection
    {
        return Provider::where('is_active', true)->orderBy('name', 'asc')->get();
    }

    public function findById(int $id): ?Provider
    {
        return Provider::find($id);
    }

    public function findByName(string $name): ?Provider
    {
        return Provider::where('name', $name)->first();
    }

    public function syncWithDigiflazz(array $digiflazzProducts): void
    {
        foreach ($digiflazzProducts as $dp) {
            // 1. Sync DigiflazzProduct model
            \App\Models\DigiflazzProduct::updateOrCreate(
                ['buyer_sku_code' => $dp['buyer_sku_code']],
                [
                    'product_name' => $dp['product_name'],
                    'category' => $dp['category'],
                    'brand' => $dp['brand'],
                    'seller_price' => $dp['seller_price'],
                    'buyer_product_status' => (bool)$dp['buyer_product_status'],
                    'seller_product_status' => (bool)$dp['seller_product_status'],
                    'unlimited_stock' => (bool)$dp['unlimited_stock'],
                    'desc' => $dp['desc'] ?? null,
                ]
            );

            // 2. Map & Sync ProductCategory
            $categorySlug = \Illuminate\Support\Str::slug($dp['category']);
            $category = \App\Models\ProductCategory::updateOrCreate(
                ['slug' => $categorySlug],
                [
                    'name' => $dp['category'],
                    'icon' => 'box',
                ]
            );

            // 3. Map & Sync Provider
            $provider = \App\Models\Provider::updateOrCreate(
                ['name' => $dp['brand']],
                [
                    'logo' => \Illuminate\Support\Str::slug($dp['brand']) . '.png',
                    'is_active' => true,
                ]
            );

            // 4. Map & Sync Product
            $isActive = (bool)$dp['buyer_product_status'] && (bool)$dp['seller_product_status'];
            $basePrice = (float)$dp['seller_price'];
            $sellPrice = $basePrice + 1500.00; // Markup logic

            \App\Models\Product::updateOrCreate(
                ['sku_code' => $dp['buyer_sku_code']],
                [
                    'product_category_id' => $category->id,
                    'provider_id' => $provider->id,
                    'name' => $dp['product_name'],
                    'base_price' => $basePrice,
                    'sell_price' => $sellPrice,
                    'admin_fee' => 0.00,
                    'status' => $isActive,
                ]
            );
        }
    }
}
