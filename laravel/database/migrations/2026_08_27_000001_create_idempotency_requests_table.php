<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sprint 3 — SRS 14.1 Idempotency Key.
 * Source of truth for request-level idempotency (not transactions.idempotency_key).
 * Reversible; does not drop existing columns/tables.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('idempotency_requests', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable()->index();
            $table->string('key', 80);
            $table->string('endpoint', 191);
            $table->string('request_hash', 64);
            $table->longText('response_snapshot')->nullable();
            // processing | completed | failed | archived
            $table->string('status', 32)->default('processing');
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('archived_at')->nullable();

            $table->unique(['key', 'endpoint'], 'uniq_idempotency_key_endpoint');
            $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('idempotency_requests');
    }
};
