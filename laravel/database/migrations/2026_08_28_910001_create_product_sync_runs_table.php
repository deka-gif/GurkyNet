<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * FR-OPS-08/09/10, Bagian 15 — dedicated catalog-sync run history. Additive only;
 * does not touch products/transactions/wallet history. Never stores credentials —
 * only run-level counts and a short error summary.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('product_sync_runs', function (Blueprint $table) {
            $table->id();
            $table->string('provider_code'); // digiflazz | vip
            $table->string('list_type')->nullable(); // digiflazz cmd: prepaid | pasca; null for VIP
            $table->string('triggered_by')->default('manual'); // scheduled | manual | queued
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('started_at');
            $table->timestamp('completed_at')->nullable();
            $table->string('status')->default('running'); // running | success | partial | failed
            $table->unsignedInteger('fetched_count')->default(0);
            $table->unsignedInteger('created_count')->default(0);
            $table->unsignedInteger('updated_count')->default(0);
            $table->unsignedInteger('deactivated_count')->default(0);
            $table->unsignedInteger('error_count')->default(0);
            $table->text('error_summary')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['provider_code', 'started_at']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_sync_runs');
    }
};
