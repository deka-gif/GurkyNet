<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// SRS Bagian 7.4 — Sprint 1 (Skema Basis Data Inti).
// Tabel harga bertingkat per agent_level. `products.sell_price` TIDAK dipindahkan —
// pemakaian tabel ini sebagai sumber harga aktif adalah scope Sprint 3 (Pricing).
// product_id: ON DELETE RESTRICT (ENGINEERING DECISION — baris harga bersifat historis,
// tidak boleh ikut terhapus/cascade saat produk induk dihapus).
return new class extends Migration {
    public function up(): void
    {
        Schema::create('product_prices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->onDelete('restrict');
            $table->string('agent_level', 255);
            $table->decimal('sell_price', 15, 2);
            $table->timestamp('effective_from');
            $table->boolean('is_current');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_prices');
    }
};
