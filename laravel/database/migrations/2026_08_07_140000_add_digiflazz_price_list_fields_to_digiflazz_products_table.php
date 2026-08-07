<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('digiflazz_products', function (Blueprint $table) {
            // Price-list source: prepaid | pasca (needed for safe missing-SKU deactivation)
            $table->string('list_type', 16)->nullable()->after('buyer_sku_code')->index();

            // Prepaid-only Digiflazz fields
            $table->string('type')->nullable()->after('brand');
            $table->string('seller_name')->nullable()->after('type');
            $table->string('stock')->nullable()->after('unlimited_stock');
            $table->boolean('multi')->nullable()->after('stock');
            $table->string('start_cut_off', 8)->nullable()->after('multi');
            $table->string('end_cut_off', 8)->nullable()->after('start_cut_off');

            // Pascabayar Digiflazz fields
            $table->unsignedInteger('admin')->nullable()->after('seller_price');
            $table->unsignedInteger('commission')->nullable()->after('admin');
        });
    }

    public function down(): void
    {
        Schema::table('digiflazz_products', function (Blueprint $table) {
            $table->dropColumn([
                'list_type',
                'type',
                'seller_name',
                'stock',
                'multi',
                'start_cut_off',
                'end_cut_off',
                'admin',
                'commission',
            ]);
        });
    }
};
