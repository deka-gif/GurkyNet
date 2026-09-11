<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * P1-E — loyalty ledger idempotency keys must be scoped per user.
 *
 * Before: UNIQUE(idempotency_key, type) — User A redeeming with User B's key
 * could replay B's already_processed payload (transaction_id leak) or block A.
 * After: UNIQUE(user_id, idempotency_key, type).
 *
 * Safe for existing rows: prior global UNIQUE already implies no duplicate
 * (user_id, idempotency_key, type) pairs.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('loyalty_point_ledgers', function (Blueprint $table) {
            $table->dropUnique('loyalty_ledger_idem_type_unique');
        });

        Schema::table('loyalty_point_ledgers', function (Blueprint $table) {
            $table->unique(
                ['user_id', 'idempotency_key', 'type'],
                'loyalty_ledger_user_idem_type_unique'
            );
        });
    }

    public function down(): void
    {
        Schema::table('loyalty_point_ledgers', function (Blueprint $table) {
            $table->dropUnique('loyalty_ledger_user_idem_type_unique');
        });

        Schema::table('loyalty_point_ledgers', function (Blueprint $table) {
            $table->unique(['idempotency_key', 'type'], 'loyalty_ledger_idem_type_unique');
        });
    }
};
