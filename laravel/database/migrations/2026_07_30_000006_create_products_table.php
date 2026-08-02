<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_category_id')->constrained('product_categories')->onDelete('restrict');
            $table->foreignId('provider_id')->nullable()->constrained('providers')->onDelete('set null');
            $table->string('sku_code')->unique();
            $table->string('name');
            $table->decimal('base_price', 15, 2);
            $table->decimal('sell_price', 15, 2);
            $table->decimal('admin_fee', 15, 2)->default(0.00);
            $table->boolean('status')->default(true); // true = aktif, false = nonaktif
            $table->softDeletes();
            $table->timestamps();

            // Indexing
            $table->index('product_category_id');
            $table->index('sku_code');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
