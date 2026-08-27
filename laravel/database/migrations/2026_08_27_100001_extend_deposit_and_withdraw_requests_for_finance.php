<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sprint 4 — FR-FIN-03 / FR-FIN-05.
 * Additive columns on deposit_requests & withdraw_requests (SRS 7.7).
 * Reversible; does not drop base tables or historical rows.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('deposit_requests')) {
            Schema::table('deposit_requests', function (Blueprint $table) {
                if (!Schema::hasColumn('deposit_requests', 'notes')) {
                    $table->text('notes')->nullable()->after('status');
                }
                if (!Schema::hasColumn('deposit_requests', 'rejection_reason')) {
                    $table->string('rejection_reason', 500)->nullable()->after('notes');
                }
                if (!Schema::hasColumn('deposit_requests', 'transaction_id')) {
                    $table->foreignId('transaction_id')->nullable()->after('rejection_reason')
                        ->constrained('transactions')->nullOnDelete();
                }
            });
        }

        if (Schema::hasTable('withdraw_requests')) {
            Schema::table('withdraw_requests', function (Blueprint $table) {
                if (!Schema::hasColumn('withdraw_requests', 'bank_name')) {
                    $table->string('bank_name', 100)->nullable()->after('method');
                }
                if (!Schema::hasColumn('withdraw_requests', 'account_number')) {
                    $table->string('account_number', 64)->nullable()->after('bank_name');
                }
                if (!Schema::hasColumn('withdraw_requests', 'account_holder')) {
                    $table->string('account_holder', 150)->nullable()->after('account_number');
                }
                if (!Schema::hasColumn('withdraw_requests', 'admin_fee')) {
                    $table->decimal('admin_fee', 15, 2)->default(0)->after('amount');
                }
                if (!Schema::hasColumn('withdraw_requests', 'notes')) {
                    $table->text('notes')->nullable()->after('status');
                }
                if (!Schema::hasColumn('withdraw_requests', 'rejection_reason')) {
                    $table->string('rejection_reason', 500)->nullable()->after('notes');
                }
                if (!Schema::hasColumn('withdraw_requests', 'transaction_id')) {
                    $table->foreignId('transaction_id')->nullable()->after('rejection_reason')
                        ->constrained('transactions')->nullOnDelete();
                }
                if (!Schema::hasColumn('withdraw_requests', 'workflow')) {
                    // 'hold_queue' = Sprint 4 SRS path; 'legacy_debit' = pre-Sprint-4 immediate debit (read-only).
                    $table->string('workflow', 32)->default('hold_queue')->after('transaction_id');
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('deposit_requests')) {
            Schema::table('deposit_requests', function (Blueprint $table) {
                foreach (['transaction_id', 'rejection_reason', 'notes'] as $col) {
                    if (Schema::hasColumn('deposit_requests', $col)) {
                        if ($col === 'transaction_id') {
                            $table->dropConstrainedForeignId('transaction_id');
                        } else {
                            $table->dropColumn($col);
                        }
                    }
                }
            });
        }

        if (Schema::hasTable('withdraw_requests')) {
            Schema::table('withdraw_requests', function (Blueprint $table) {
                if (Schema::hasColumn('withdraw_requests', 'transaction_id')) {
                    $table->dropConstrainedForeignId('transaction_id');
                }
                foreach (['workflow', 'rejection_reason', 'notes', 'admin_fee', 'account_holder', 'account_number', 'bank_name'] as $col) {
                    if (Schema::hasColumn('withdraw_requests', $col)) {
                        $table->dropColumn($col);
                    }
                }
            });
        }
    }
};
