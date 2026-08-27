<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * SRS Bagian 31 — Referral Berjenjang (FR-REF-01..09).
 * Additive + reversible. Does not alter historical wallet/transaction rows.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('referral_codes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('code', 20);
            $table->boolean('is_custom')->default(false);
            $table->timestamps();

            $table->unique('code');
            $table->unique('user_id');
        });

        Schema::create('referral_relations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('downline_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('upline_user_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedTinyInteger('level'); // 1 or 2 only
            $table->timestamp('created_at')->useCurrent();

            $table->unique(['downline_user_id', 'level']);
            $table->unique(['downline_user_id', 'upline_user_id']);
            $table->index(['upline_user_id', 'level']);
        });

        Schema::create('commission_rules', function (Blueprint $table) {
            $table->id();
            $table->unsignedTinyInteger('level'); // 1 or 2
            $table->decimal('percentage', 8, 4);
            $table->timestamp('effective_from');
            $table->boolean('is_current')->default(true);
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('reason', 255)->nullable();
            $table->timestamps();

            $table->index(['level', 'is_current']);
        });

        Schema::create('commission_ledger', function (Blueprint $table) {
            $table->id();
            $table->foreignId('upline_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('downline_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('source_transaction_id')->constrained('transactions')->restrictOnDelete();
            $table->unsignedTinyInteger('level');
            $table->decimal('amount', 15, 2);
            $table->decimal('rate_percentage', 8, 4);
            $table->string('status', 32); // pending|released|reversed|finance_review
            $table->timestamp('release_at')->nullable();
            $table->timestamp('released_at')->nullable();
            $table->timestamp('reversed_at')->nullable();
            $table->string('finance_review_reason', 255)->nullable();
            // No FK to wallet_mutations — enum alter recreates that table on SQLite.
            $table->unsignedBigInteger('wallet_mutation_id')->nullable();
            $table->timestamps();

            $table->unique(['source_transaction_id', 'level'], 'commission_ledger_tx_level_unique');
            $table->index(['status', 'release_at']);
            $table->index(['upline_user_id', 'status', 'released_at']);
            $table->index('wallet_mutation_id');
        });

        Schema::create('referral_fraud_flags', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('signal', 64);
            $table->json('evidence')->nullable();
            $table->json('related_user_ids')->nullable();
            $table->foreignId('related_transaction_id')->nullable()->constrained('transactions')->nullOnDelete();
            $table->string('status', 32)->default('flagged'); // flagged|reviewed|dismissed
            $table->timestamp('detected_at');
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->text('review_note')->nullable();
            $table->timestamps();

            $table->index(['status', 'detected_at']);
            $table->index(['signal', 'detected_at']);
        });

        // Seed locked Sprint 16 rates (Finance may update later via history rows).
        $now = now();
        DB::table('commission_rules')->insert([
            [
                'level' => 1,
                'percentage' => 1.0000,
                'effective_from' => $now,
                'is_current' => true,
                'updated_by' => null,
                'reason' => 'Sprint 16 locked default L1=1%',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'level' => 2,
                'percentage' => 0.5000,
                'effective_from' => $now,
                'is_current' => true,
                'updated_by' => null,
                'reason' => 'Sprint 16 locked default L2=0.5%',
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('referral_fraud_flags');
        Schema::dropIfExists('commission_ledger');
        Schema::dropIfExists('commission_rules');
        Schema::dropIfExists('referral_relations');
        Schema::dropIfExists('referral_codes');
    }
};
