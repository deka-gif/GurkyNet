<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sprint 8.3 — Finance Command Center.
 */
return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('finance_ledger_entries')) {
            Schema::create('finance_ledger_entries', function (Blueprint $table) {
                $table->id();
                $table->string('ledger_code', 64)->unique();
                $table->unsignedBigInteger('workflow_id')->nullable()->index();
                $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('transaction_id')->nullable()->constrained('transactions')->nullOnDelete();
                $table->unsignedBigInteger('payment_history_id')->nullable()->index();
                $table->unsignedBigInteger('wallet_history_id')->nullable()->index();
                $table->string('invoice', 128)->nullable()->index();
                $table->string('source_module', 32);
                $table->string('event_type', 64);
                $table->decimal('debit', 18, 2)->default(0);
                $table->decimal('credit', 18, 2)->default(0);
                $table->decimal('balance_snapshot', 18, 2)->nullable();
                $table->string('currency', 8)->default('IDR');
                $table->string('reference', 191)->nullable();
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->json('meta')->nullable();
                $table->timestamps();

                $table->index(['event_type', 'created_at']);
                $table->index(['user_id', 'created_at']);
            });
        }

        if (! Schema::hasTable('finance_settlements')) {
            Schema::create('finance_settlements', function (Blueprint $table) {
                $table->id();
                $table->string('settlement_code', 64)->unique();
                $table->unsignedBigInteger('workflow_id')->nullable()->index();
                $table->string('gateway', 64);
                $table->string('provider', 64)->nullable();
                $table->string('batch_number', 128)->nullable();
                $table->string('settlement_reference', 191)->nullable();
                $table->decimal('amount', 18, 2);
                $table->string('currency', 8)->default('IDR');
                $table->string('status', 32)->default('pending');
                $table->text('notes')->nullable();
                $table->json('evidence')->nullable();
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('completed_at')->nullable();
                $table->softDeletes();
                $table->timestamps();

                $table->index(['status', 'created_at']);
                $table->index('gateway');
            });
        }

        if (! Schema::hasTable('finance_alerts')) {
            Schema::create('finance_alerts', function (Blueprint $table) {
                $table->id();
                $table->string('alert_code', 64)->unique();
                $table->string('type', 64);
                $table->string('severity', 16)->default('info');
                $table->string('title');
                $table->text('body')->nullable();
                $table->json('payload')->nullable();
                $table->string('status', 32)->default('open');
                $table->string('related_type', 64)->nullable();
                $table->unsignedBigInteger('related_id')->nullable();
                $table->unsignedBigInteger('workflow_id')->nullable()->index();
                $table->timestamp('read_at')->nullable();
                $table->timestamp('resolved_at')->nullable();
                $table->timestamps();

                $table->index(['status', 'severity']);
                $table->index(['type', 'status']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_alerts');
        Schema::dropIfExists('finance_settlements');
        Schema::dropIfExists('finance_ledger_entries');
    }
};
