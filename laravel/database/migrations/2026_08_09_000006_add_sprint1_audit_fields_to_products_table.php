<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// SRS Bagian 7.3 — Sprint 1 (Skema Basis Data Inti).
// Migration ADDITIVE: menambah created_by/updated_by saja. Tidak menyentuh
// product_category_id, provider_id, sku_code, base_price, sell_price, status, ops_status.
// created_by/updated_by: ON DELETE SET NULL (ENGINEERING DECISION — relasi opsional,
// tidak boleh menghalangi penghapusan akun staf).
return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasColumn('products', 'created_by')) {
            Schema::table('products', function (Blueprint $table) {
                $table->foreignId('created_by')->nullable()->constrained('users')->onDelete('set null');
            });
        }

        if (!Schema::hasColumn('products', 'updated_by')) {
            Schema::table('products', function (Blueprint $table) {
                $table->foreignId('updated_by')->nullable()->constrained('users')->onDelete('set null');
            });
        }
    }

    public function down(): void
    {
        foreach (['updated_by', 'created_by'] as $column) {
            if (Schema::hasColumn('products', $column)) {
                Schema::table('products', function (Blueprint $table) use ($column) {
                    $table->dropForeign([$column]);
                });
                Schema::table('products', function (Blueprint $table) use ($column) {
                    $table->dropColumn($column);
                });
            }
        }
    }
};
