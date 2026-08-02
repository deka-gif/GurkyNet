<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('transaction_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('transaction_id')->constrained('transactions')->onDelete('cascade');
            $table->string('product_code');
            $table->string('product_name');
            $table->decimal('price', 15, 2);
            $table->integer('quantity')->default(1);
            $table->json('custom_metadata')->nullable(); // For custom details like PLNs name, kwh, serial numbers
            $table->timestamps();

            // Indexing
            $table->index('transaction_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transaction_items');
    }
};
