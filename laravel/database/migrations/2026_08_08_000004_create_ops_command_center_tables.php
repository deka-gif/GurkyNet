<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sprint 8.4 — Operations Command Center.
 */
return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('ops_alerts')) {
            Schema::create('ops_alerts', function (Blueprint $table) {
                $table->id();
                $table->string('alert_code', 64)->unique();
                $table->string('type', 64);
                $table->string('severity', 16)->default('info');
                $table->string('title');
                $table->text('body')->nullable();
                $table->json('payload')->nullable();
                $table->string('status', 32)->default('open');
                $table->string('source', 32)->default('monitor');
                $table->string('related_type', 64)->nullable();
                $table->unsignedBigInteger('related_id')->nullable();
                $table->unsignedBigInteger('workflow_id')->nullable()->index();
                $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('acknowledged_at')->nullable();
                $table->timestamp('resolved_at')->nullable();
                $table->timestamp('closed_at')->nullable();
                $table->timestamps();

                $table->index(['status', 'severity']);
                $table->index(['type', 'status']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('ops_alerts');
    }
};
