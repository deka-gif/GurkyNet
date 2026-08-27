<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * FR-DIFF-01 — allow wallet_mutations.type = loyalty_redeem for poin → wallet credit.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('wallet_mutations')) {
            return;
        }

        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE wallet_mutations MODIFY COLUMN type ENUM('topup','purchase','refund','withdraw','adjustment','hold','loyalty_redeem') NOT NULL");

            return;
        }

        if ($driver === 'sqlite') {
            Schema::rename('wallet_mutations', 'wallet_mutations_old_s14');
            Schema::create('wallet_mutations', function (Blueprint $table) {
                $table->id();
                $table->foreignId('wallet_id')->constrained('wallets')->cascadeOnDelete();
                $table->enum('type', ['topup', 'purchase', 'refund', 'withdraw', 'adjustment', 'hold', 'loyalty_redeem']);
                $table->decimal('amount', 15, 2);
                $table->string('reference_id')->nullable();
                $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
            });
            DB::statement('INSERT INTO wallet_mutations (id, wallet_id, type, amount, reference_id, approved_by, created_at, updated_at)
                SELECT id, wallet_id, type, amount, reference_id, approved_by, created_at, updated_at FROM wallet_mutations_old_s14');
            Schema::drop('wallet_mutations_old_s14');
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('wallet_mutations')) {
            return;
        }

        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql') {
            DB::table('wallet_mutations')->where('type', 'loyalty_redeem')->update(['type' => 'topup']);
            DB::statement("ALTER TABLE wallet_mutations MODIFY COLUMN type ENUM('topup','purchase','refund','withdraw','adjustment','hold') NOT NULL");

            return;
        }

        if ($driver === 'sqlite') {
            DB::table('wallet_mutations')->where('type', 'loyalty_redeem')->update(['type' => 'topup']);
            Schema::rename('wallet_mutations', 'wallet_mutations_old_s14_down');
            Schema::create('wallet_mutations', function (Blueprint $table) {
                $table->id();
                $table->foreignId('wallet_id')->constrained('wallets')->cascadeOnDelete();
                $table->enum('type', ['topup', 'purchase', 'refund', 'withdraw', 'adjustment', 'hold']);
                $table->decimal('amount', 15, 2);
                $table->string('reference_id')->nullable();
                $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
            });
            DB::statement('INSERT INTO wallet_mutations (id, wallet_id, type, amount, reference_id, approved_by, created_at, updated_at)
                SELECT id, wallet_id, type, amount, reference_id, approved_by, created_at, updated_at FROM wallet_mutations_old_s14_down');
            Schema::drop('wallet_mutations_old_s14_down');
        }
    }
};
