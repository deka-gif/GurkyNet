<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Phase 20 — persist ProductMappingService's classification `source` (already computed
 * on every sync, previously discarded) so Operations can see which products fell through
 * to the unmapped/name-keyword fallback instead of a confident provider-category match.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('category_mapping_source')->nullable()->after('product_category_id');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('category_mapping_source');
        });
    }
};
