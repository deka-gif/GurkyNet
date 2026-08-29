<?php

namespace Tests\Feature;

use App\Models\ProductCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class TagihanSubcategoriesMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_migration_seeds_missing_tagihan_subcategories_idempotently(): void
    {
        Artisan::call('migrate', [
            '--path' => 'database/migrations/2026_08_29_160000_seed_tagihan_product_subcategories.php',
        ]);

        foreach ([
            'pln-pascabayar',
            'pdam',
            'bpjs-kesehatan',
            'bpjs-tk',
            'pbb',
            'samsat',
            'multifinance',
        ] as $slug) {
            $cat = ProductCategory::where('slug', $slug)->first();
            $this->assertNotNull($cat, "Missing category slug: {$slug}");
        }

        // Idempotent second run must not duplicate slugs.
        Artisan::call('migrate', [
            '--path' => 'database/migrations/2026_08_29_160000_seed_tagihan_product_subcategories.php',
        ]);

        $this->assertSame(7, ProductCategory::whereIn('slug', [
            'pln-pascabayar',
            'pdam',
            'bpjs-kesehatan',
            'bpjs-tk',
            'pbb',
            'samsat',
            'multifinance',
        ])->count());
    }
}
