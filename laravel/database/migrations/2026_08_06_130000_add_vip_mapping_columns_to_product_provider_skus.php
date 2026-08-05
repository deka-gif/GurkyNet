<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * VIP catalog mapping columns on product_provider_skus.
 * Digiflazz rows remain valid (new columns nullable).
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('product_provider_skus', function (Blueprint $table) {
            if (!Schema::hasColumn('product_provider_skus', 'provider_name')) {
                $table->string('provider_name')->nullable()->after('provider_sku');
            }
            if (!Schema::hasColumn('product_provider_skus', 'provider_price')) {
                $table->decimal('provider_price', 15, 2)->nullable()->after('base_price');
            }
            if (!Schema::hasColumn('product_provider_skus', 'provider_status')) {
                $table->string('provider_status', 32)->nullable()->after('provider_price');
            }
        });
    }

    public function down(): void
    {
        Schema::table('product_provider_skus', function (Blueprint $table) {
            $cols = array_filter(['provider_name', 'provider_price', 'provider_status'], fn ($c) => Schema::hasColumn('product_provider_skus', $c));
            if ($cols !== []) {
                $table->dropColumn($cols);
            }
        });
    }
};
