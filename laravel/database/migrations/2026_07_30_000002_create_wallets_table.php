<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('wallets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained('users')->onDelete('cascade');
            $table->string('wallet_number')->unique();
            $table->decimal('balance', 15, 2)->default(0.00);
            $table->string('status')->default('active'); // active, suspended, locked
            $table->softDeletes();
            $table->timestamps();

            // Indexing
            $table->index('user_id');
            $table->index('wallet_number');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wallets');
    }
};
