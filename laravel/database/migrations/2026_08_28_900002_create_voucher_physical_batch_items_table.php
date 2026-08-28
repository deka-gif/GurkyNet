<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('voucher_physical_batch_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('batch_id')->constrained('voucher_physical_batches')->onDelete('cascade');
            $table->string('serial_number');
            // queued | processing | success | failed | refunded
            $table->string('status')->default('queued');
            $table->timestamp('scanned_at')->nullable(); // client-supplied — scanning never hits the network
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('activated_at')->nullable();
            $table->string('provider_code')->nullable();
            $table->string('provider_sku')->nullable();
            $table->string('provider_ref')->nullable();
            $table->string('failure_reason')->nullable();
            $table->decimal('refund_amount', 15, 2)->nullable();
            $table->timestamp('refunded_at')->nullable();
            $table->unsignedInteger('retry_count')->default(0);
            $table->timestamps();

            $table->unique(['batch_id', 'serial_number']);
            $table->index(['batch_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('voucher_physical_batch_items');
    }
};
