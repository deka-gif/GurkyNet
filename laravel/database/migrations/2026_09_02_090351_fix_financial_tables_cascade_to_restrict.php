<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// P0-6 — Financial/audit tables must not cascade-delete when parent user/wallet/transaction
// is removed. Aligns with wallet_mutations (restrict) and transactions.product_id (set null).
return new class extends Migration {
    public function up(): void
    {
        Schema::table('wallets', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->foreign('user_id')->references('id')->on('users')->restrictOnDelete();
        });

        Schema::table('wallet_histories', function (Blueprint $table) {
            $table->dropForeign(['wallet_id']);
            $table->foreign('wallet_id')->references('id')->on('wallets')->restrictOnDelete();
        });

        Schema::table('transactions', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->foreign('user_id')->references('id')->on('users')->restrictOnDelete();
        });

        Schema::table('payment_histories', function (Blueprint $table) {
            $table->dropForeign(['transaction_id']);
            $table->foreign('transaction_id')->references('id')->on('transactions')->restrictOnDelete();
        });

        Schema::table('midtrans_transactions', function (Blueprint $table) {
            $table->dropForeign(['transaction_id']);
            $table->foreign('transaction_id')->references('id')->on('transactions')->restrictOnDelete();
        });

        Schema::table('digiflazz_transactions', function (Blueprint $table) {
            $table->dropForeign(['transaction_id']);
            $table->foreign('transaction_id')->references('id')->on('transactions')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('digiflazz_transactions', function (Blueprint $table) {
            $table->dropForeign(['transaction_id']);
            $table->foreign('transaction_id')->references('id')->on('transactions')->cascadeOnDelete();
        });

        Schema::table('midtrans_transactions', function (Blueprint $table) {
            $table->dropForeign(['transaction_id']);
            $table->foreign('transaction_id')->references('id')->on('transactions')->cascadeOnDelete();
        });

        Schema::table('payment_histories', function (Blueprint $table) {
            $table->dropForeign(['transaction_id']);
            $table->foreign('transaction_id')->references('id')->on('transactions')->cascadeOnDelete();
        });

        Schema::table('transactions', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });

        Schema::table('wallet_histories', function (Blueprint $table) {
            $table->dropForeign(['wallet_id']);
            $table->foreign('wallet_id')->references('id')->on('wallets')->cascadeOnDelete();
        });

        Schema::table('wallets', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }
};
