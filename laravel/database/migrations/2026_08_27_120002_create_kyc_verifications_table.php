<?php

// FR-KYC-02..05 / SRS Bagian 21 — kyc_verifications (additive, reversible).
// Photo columns store private-disk relative paths (NOT public URLs).

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('kyc_verifications')) {
            return;
        }

        Schema::create('kyc_verifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedTinyInteger('tier')->default(2);
            $table->string('ktp_full_name', 255);
            $table->string('ktp_number', 32);
            // Private storage paths — never public CDN URLs (Bagian 21 safety).
            $table->string('ktp_photo_path', 512);
            $table->string('selfie_photo_path', 512);
            $table->string('bank_name', 100)->nullable();
            $table->string('bank_account_name', 255);
            $table->string('bank_account_number', 64);
            $table->string('status', 32)->default('pending'); // pending|approved|rejected
            $table->text('rejection_reason')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
            $table->index(['status', 'submitted_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('kyc_verifications');
    }
};
