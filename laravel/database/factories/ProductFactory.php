<?php

namespace Database\Factories;

use App\Models\Product;
use App\Models\ProductCategory;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class ProductFactory extends Factory
{
    protected $model = Product::class;

    public function definition(): array
    {
        $faker = $this->faker ?? (function_exists('fake') ? fake() : null);
        $base = $faker ? $faker->randomElement([5000, 10000, 20000, 50000, 100000]) : 10000;
        $skuCode = $faker ? ('SKU-' . strtoupper($faker->unique()->lexify('??????')) . '-' . $base) : ('SKU-' . strtoupper(Str::random(6)) . '-' . $base);
        $name = $faker ? ('Product ' . $faker->word() . ' ' . $base) : ('Produk ' . Str::random(4) . ' ' . $base);
        $adminFee = $faker ? $faker->randomElement([0, 2500]) : 0;

        return [
            'product_category_id' => ProductCategory::factory(),
            'sku_code' => $skuCode,
            'name' => $name,
            'base_price' => $base,
            'sell_price' => $base + 1500, // Add profit margin
            'admin_fee' => $adminFee,
            'status' => true,
        ];
    }
}
