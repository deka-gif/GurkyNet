<?php

namespace Database\Factories;

use App\Models\Product;
use App\Models\ProductCategory;
use Illuminate\Database\Eloquent\Factories\Factory;

class ProductFactory extends Factory
{
    protected $model = Product::class;

    public function definition(): array
    {
        $base = $this->faker->randomElement([5000, 10000, 20000, 50000, 100000]);
        return [
            'product_category_id' => ProductCategory::factory(),
            'sku_code' => 'SKU-' . strtoupper($this->faker->unique()->lexify('??????')) . '-' . $base,
            'name' => 'Product ' . $this->faker->word() . ' ' . $base,
            'base_price' => $base,
            'sell_price' => $base + 1500, // Add profit margin
            'admin_fee' => $this->faker->randomElement([0, 2500]),
            'status' => true,
        ];
    }
}
