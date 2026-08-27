<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * FR-DIFF-02 / SRS 12.2 — user_subscriptions for Auto-Reorder.
 * Additive + reversible. Does not alter transactions/wallets history.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->restrictOnDelete();
            $table->string('target_number', 64);
            $table->unsignedTinyInteger('schedule_day'); // 1–28 safe calendar day
            $table->string('status', 32)->default('active'); // active|paused|canceled
            $table->timestamp('next_run_at')->nullable();
            $table->timestamp('last_run_at')->nullable();
            $table->unsignedTinyInteger('retry_count')->default(0);
            $table->timestamp('next_retry_at')->nullable();
            $table->string('last_failure_reason', 255)->nullable();
            $table->foreignId('last_transaction_id')->nullable()->constrained('transactions')->nullOnDelete();
            $table->string('idempotency_seed', 64)->nullable();
            $table->timestamps();

            $table->index(['status', 'next_run_at']);
            $table->index(['status', 'next_retry_at']);
            $table->index(['user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_subscriptions');
    }
};
