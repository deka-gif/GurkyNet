<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * P1-B — SRS 14.1: idempotency key uniqueness must be scoped per authenticated user.
 *
 * Before: UNIQUE(key, endpoint) — User B reusing User A's key on the same endpoint could
 * replay A's response_snapshot (cross-user leak / blocked independent mutation).
 * After: UNIQUE(user_id, key, endpoint).
 *
 * Safe for existing rows: the prior global UNIQUE(key, endpoint) already guarantees
 * no duplicate (user_id, key, endpoint) pairs can exist.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('idempotency_requests', function (Blueprint $table) {
            $table->dropUnique('uniq_idempotency_key_endpoint');
        });

        Schema::table('idempotency_requests', function (Blueprint $table) {
            $table->unique(['user_id', 'key', 'endpoint'], 'uniq_idempotency_user_key_endpoint');
        });
    }

    public function down(): void
    {
        Schema::table('idempotency_requests', function (Blueprint $table) {
            $table->dropUnique('uniq_idempotency_user_key_endpoint');
        });

        Schema::table('idempotency_requests', function (Blueprint $table) {
            $table->unique(['key', 'endpoint'], 'uniq_idempotency_key_endpoint');
        });
    }
};
