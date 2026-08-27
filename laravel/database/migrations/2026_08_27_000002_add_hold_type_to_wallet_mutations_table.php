<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Sprint 3 — SRS 14.3 LOCKED requires mutation type=hold.
 * SRS 7.6 listed topup/purchase/refund/withdraw/adjustment; 14.3 adds hold.
 * Additive enum expansion only — reversible; no data drop.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('wallet_mutations')) {
            return;
        }

        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE wallet_mutations MODIFY COLUMN type ENUM('topup','purchase','refund','withdraw','adjustment','hold') NOT NULL");

            return;
        }

        if ($driver === 'sqlite') {
            // SQLite stores enum as CHECK — rebuild table to allow 'hold'.
            Schema::rename('wallet_mutations', 'wallet_mutations_old_s3');

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
                SELECT id, wallet_id, type, amount, reference_id, approved_by, created_at, updated_at FROM wallet_mutations_old_s3');

            Schema::drop('wallet_mutations_old_s3');
        }
    }

    public function down(): void
    {
        if (!Schema::hasTable('wallet_mutations')) {
            return;
        }

        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'mysql') {
            DB::table('wallet_mutations')->where('type', 'hold')->update(['type' => 'purchase']);
            DB::statement("ALTER TABLE wallet_mutations MODIFY COLUMN type ENUM('topup','purchase','refund','withdraw','adjustment') NOT NULL");

            return;
        }

        if ($driver === 'sqlite') {
            DB::table('wallet_mutations')->where('type', 'hold')->update(['type' => 'purchase']);
            Schema::rename('wallet_mutations', 'wallet_mutations_old_s3_down');

            Schema::create('wallet_mutations', function (Blueprint $table) {
                $table->id();
                $table->foreignId('wallet_id')->constrained('wallets')->cascadeOnDelete();
                $table->enum('type', ['topup', 'purchase', 'refund', 'withdraw', 'adjustment']);
                $table->decimal('amount', 15, 2);
                $table->string('reference_id')->nullable();
                $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
            });

            DB::statement('INSERT INTO wallet_mutations (id, wallet_id, type, amount, reference_id, approved_by, created_at, updated_at)
                SELECT id, wallet_id, type, amount, reference_id, approved_by, created_at, updated_at FROM wallet_mutations_old_s3_down');

            Schema::drop('wallet_mutations_old_s3_down');
        }
    }
};
