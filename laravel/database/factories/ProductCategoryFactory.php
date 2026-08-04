<?php

namespace Database\Factories;

use App\Models\ProductCategory;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class ProductCategoryFactory extends Factory
{
    protected $model = ProductCategory::class;

    public function definition(): array
    {
        $faker = $this->faker ?? (function_exists('fake') ? fake() : null);
        $name = $faker ? $faker->unique()->word() : ('Category ' . Str::random(5));
        $slug = Str::slug($name) . '-' . Str::random(4);

        return [
            'name' => ucfirst($name),
            'slug' => $slug,
            'icon' => 'grid',
        ];
    }
}
