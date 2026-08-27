<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * FR-DIFF-01 / FR-DIFF-08 — SRS 12.2 loyalty_points + loyalty_tiers (+ ledger for earn/redeem/expiry/audit).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('loyalty_tiers', function (Blueprint $table) {
            $table->id();
            $table->string('tier_name', 32)->unique();
            $table->unsignedBigInteger('min_monthly_transaction')->default(0);
            $table->json('benefit_json')->nullable();
            $table->unsignedTinyInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('loyalty_points', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained('users')->cascadeOnDelete();
            $table->unsignedBigInteger('points_balance')->default(0);
            $table->unsignedBigInteger('points_held_clawback')->default(0);
            $table->string('current_tier', 32)->default('Reguler');
            $table->string('grace_anchor_month', 7)->nullable(); // YYYY-MM
            $table->timestamps();
        });

        // Earn/redeem/reverse/expire/adjust history — required for FIFO expiry + unique earn.
        Schema::create('loyalty_point_ledgers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('type', 32); // earn|redeem|reverse|expire|adjust|clawback_hold
            $table->bigInteger('points'); // signed magnitude for ledger display
            $table->unsignedBigInteger('remaining_points')->default(0); // earn batches only
            $table->foreignId('transaction_id')->nullable()->constrained('transactions')->nullOnDelete();
            $table->timestamp('expires_at')->nullable();
            $table->string('status', 32)->default('posted'); // posted|held|released
            $table->string('reference', 80)->nullable();
            $table->string('idempotency_key', 80)->nullable();
            $table->text('reason')->nullable();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'type', 'created_at']);
            $table->index(['expires_at', 'remaining_points']);
            $table->unique(['idempotency_key', 'type'], 'loyalty_ledger_idem_type_unique');
        });

        // One SUCCESS purchase → one earn (FR-DIFF-01 anti-double-award).
        Schema::table('loyalty_point_ledgers', function (Blueprint $table) {
            $table->unique(['transaction_id', 'type'], 'loyalty_ledger_tx_type_unique');
        });

        if (Schema::hasTable('wallets') && ! Schema::hasColumn('wallets', 'points')) {
            Schema::table('wallets', function (Blueprint $table) {
                $table->unsignedBigInteger('points')->default(0)->after('balance');
            });
        }

        $now = now();
        DB::table('loyalty_tiers')->insert([
            [
                'tier_name' => 'Reguler',
                'min_monthly_transaction' => 0,
                'benefit_json' => json_encode(['display' => 'Benefit dasar', 'earn_rate' => '1%']),
                'sort_order' => 0,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'tier_name' => 'Silver',
                'min_monthly_transaction' => 1000000,
                'benefit_json' => json_encode(['display' => 'Tier Silver — benefit non-cash (display)', 'earn_rate' => '1%']),
                'sort_order' => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'tier_name' => 'Gold',
                'min_monthly_transaction' => 3000000,
                'benefit_json' => json_encode(['display' => 'Tier Gold — benefit non-cash (display)', 'earn_rate' => '1%']),
                'sort_order' => 2,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'tier_name' => 'Platinum',
                'min_monthly_transaction' => 5000000,
                'benefit_json' => json_encode(['display' => 'Tier Platinum — benefit non-cash (display)', 'earn_rate' => '1%']),
                'sort_order' => 3,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('loyalty_point_ledgers');
        Schema::dropIfExists('loyalty_points');
        Schema::dropIfExists('loyalty_tiers');

        if (Schema::hasTable('wallets') && Schema::hasColumn('wallets', 'points')) {
            Schema::table('wallets', function (Blueprint $table) {
                $table->dropColumn('points');
            });
        }
    }
};
