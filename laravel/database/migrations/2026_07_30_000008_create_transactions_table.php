<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->string('invoice_number')->unique();
            $table->string('service_name'); // Pulsa, Paket Data, Token PLN, dll.
            $table->string('target_number'); // No telepon, ID pelanggan PLN, dll.
            $table->decimal('amount', 15, 2);
            $table->decimal('admin_fee', 15, 2)->default(0.00);
            $table->decimal('total_payment', 15, 2);
            $table->string('payment_method')->default('wallet'); // wallet, midtrans, bank, etc.
            $table->string('status')->default('pending'); // draft, pending, processing, success, failed, canceled, expired
            $table->text('notes')->nullable();
            $table->softDeletes();
            $table->timestamps();

            // Indexing for rapid queries (essential for transaction history searches)
            $table->index('user_id');
            $table->index('invoice_number');
            $table->index('status');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transactions');
    }
};
