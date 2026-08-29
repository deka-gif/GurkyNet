<?php

use App\Models\ProductCategory;
use Illuminate\Database\Migrations\Migration;

/**
 * Seed missing Pembayaran Tagihan sub-categories (FR-OPS catalog IA).
 * Idempotent — safe to re-run; mirrors DatabaseSeeder + config/gurky_catalog.php hubs.
 */
return new class extends Migration
{
    /** @var list<array{name: string, slug: string, icon: string}> */
    private array $categories = [
        ['name' => 'PLN Pascabayar', 'slug' => 'pln-pascabayar', 'icon' => 'zap'],
        ['name' => 'PDAM', 'slug' => 'pdam', 'icon' => 'droplet'],
        ['name' => 'BPJS Kesehatan', 'slug' => 'bpjs-kesehatan', 'icon' => 'heart'],
        ['name' => 'BPJS Ketenagakerjaan', 'slug' => 'bpjs-tk', 'icon' => 'briefcase'],
        ['name' => 'PBB', 'slug' => 'pbb', 'icon' => 'home'],
        ['name' => 'SAMSAT', 'slug' => 'samsat', 'icon' => 'car'],
        ['name' => 'Multifinance', 'slug' => 'multifinance', 'icon' => 'landmark'],
    ];

    public function up(): void
    {
        foreach ($this->categories as $c) {
            $category = ProductCategory::withTrashed()->where('slug', $c['slug'])->first();

            if ($category) {
                if ($category->trashed()) {
                    $category->restore();
                }
                $category->update([
                    'name' => $c['name'],
                    'icon' => $c['icon'],
                ]);
            } else {
                ProductCategory::create([
                    'name' => $c['name'],
                    'slug' => $c['slug'],
                    'icon' => $c['icon'],
                ]);
            }
        }
    }

    public function down(): void
    {
        foreach ($this->categories as $c) {
            ProductCategory::where('slug', $c['slug'])
                ->whereDoesntHave('products')
                ->delete();
        }
    }
};
