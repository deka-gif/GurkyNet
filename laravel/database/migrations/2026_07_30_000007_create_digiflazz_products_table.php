<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('digiflazz_products', function (Blueprint $table) {
            $table->id();
            $table->string('buyer_sku_code')->unique();
            $table->string('product_name');
            $table->string('category');
            $table->string('brand');
            $table->decimal('seller_price', 15, 2);
            $table->boolean('buyer_product_status')->default(true);
            $table->boolean('seller_product_status')->default(true);
            $table->boolean('unlimited_stock')->default(true);
            $table->text('desc')->nullable();
            $table->timestamps();

            // Indexing
            $table->index('buyer_sku_code');
            $table->index('brand');
            $table->index('category');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('digiflazz_products');
    }
};
