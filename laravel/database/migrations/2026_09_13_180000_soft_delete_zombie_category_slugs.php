<?php

use App\Models\ProductCategory;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Soft-delete empty legacy/zombie category slugs (audit Item 11).
 * Canonical routes remain via gurky_catalog.filter_aliases (sms-telepon, topup-digital, tv-pascabayar, voucher-internet).
 * Reversible: down() restores soft-deleted rows.
 */
return new class extends Migration
{
    /** @var list<string> */
    private array $zombieSlugs = [
        'paket-sms-telpon',
        'ewallet',
        'tv',
        'aktivasi-voucher',
    ];

    public function up(): void
    {
        foreach ($this->zombieSlugs as $slug) {
            $cat = ProductCategory::query()->where('slug', $slug)->first();
            if (! $cat) {
                continue;
            }
            $productCount = DB::table('products')
                ->where('product_category_id', $cat->id)
                ->whereNull('deleted_at')
                ->count();
            if ($productCount > 0) {
                // Safety: never soft-delete a category that still owns live products.
                continue;
            }
            $cat->delete();
        }
    }

    public function down(): void
    {
        ProductCategory::withTrashed()
            ->whereIn('slug', $this->zombieSlugs)
            ->restore();
    }
};
