<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sprint 3 — Core User, Wallet & Transaction Foundation.
 * SRS Bagian 14.1 (Idempotency Key) + Bagian 14.2/15.3 (concurrency / provider dispatch safety).
 *
 * Additive only — no existing column, enum, or table is modified. Nullable columns keep
 * this fully backward compatible with existing rows and existing clients that do not yet
 * send an idempotency_key.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            // SRS 14.1 — client-generated key identifying one logical balance-changing action.
            // Nullable + non-unique alone: uniqueness is enforced via the composite index below.
            // Active lifetime is 24h (enforced in application logic); expired keys are nulled
            // out by the archival command / on-demand self-heal, never left permanently blocking.
            $table->string('idempotency_key', 80)->nullable()->after('notes');

            // SRS 15.3 — atomic local claim marker preventing a retried job from calling the
            // provider a second time for the same transaction. Set once, immediately before the
            // first provider dispatch attempt.
            $table->timestamp('provider_dispatch_started_at')->nullable()->after('idempotency_key');
        });

        Schema::table('transactions', function (Blueprint $table) {
            $table->unique(['user_id', 'idempotency_key'], 'uniq_transactions_user_idempotency');
        });
    }

    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropUnique('uniq_transactions_user_idempotency');
        });

        Schema::table('transactions', function (Blueprint $table) {
            $table->dropColumn(['idempotency_key', 'provider_dispatch_started_at']);
        });
    }
};
