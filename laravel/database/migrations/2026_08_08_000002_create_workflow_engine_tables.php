<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sprint 8.2 — Cross Division Workflow Engine (SSOT).
 */
return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('workflows')) {
            Schema::create('workflows', function (Blueprint $table) {
                $table->id();
                $table->string('workflow_code', 64)->unique();
                $table->string('source', 32)->default('manual'); // chat|ticket|manual|system
                $table->string('category', 64);
                $table->string('current_division', 32); // customer_support|operations|finance|marketing|admin
                $table->string('status', 32); // waiting_*|resolved|rejected|cancelled|closed
                $table->string('priority', 16)->default('medium'); // low|medium|high|critical
                $table->string('title');
                $table->text('description')->nullable();
                $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
                $table->foreignId('owner_id')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('conversation_id')->nullable()->constrained('conversations')->nullOnDelete();
                $table->foreignId('support_ticket_id')->nullable()->constrained('support_tickets')->nullOnDelete();
                $table->foreignId('transaction_id')->nullable()->constrained('transactions')->nullOnDelete();
                $table->unsignedBigInteger('product_id')->nullable();
                $table->unsignedBigInteger('product_provider_sku_id')->nullable();
                $table->unsignedBigInteger('legacy_escalation_id')->nullable();
                $table->json('meta')->nullable();
                $table->timestamp('resolved_at')->nullable();
                $table->softDeletes();
                $table->timestamps();

                $table->index(['current_division', 'status']);
                $table->index(['status', 'priority']);
                $table->index('assigned_to');
                $table->index('created_at');
            });
        }

        if (! Schema::hasTable('workflow_events')) {
            Schema::create('workflow_events', function (Blueprint $table) {
                $table->id();
                $table->foreignId('workflow_id')->constrained('workflows')->cascadeOnDelete();
                $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('event_type', 64);
                $table->string('from_division', 32)->nullable();
                $table->string('to_division', 32)->nullable();
                $table->string('from_status', 32)->nullable();
                $table->string('to_status', 32)->nullable();
                $table->string('action', 64)->nullable();
                $table->text('body')->nullable();
                $table->json('payload')->nullable();
                $table->timestamps();

                $table->index(['workflow_id', 'created_at']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('workflow_events');
        Schema::dropIfExists('workflows');
    }
};
