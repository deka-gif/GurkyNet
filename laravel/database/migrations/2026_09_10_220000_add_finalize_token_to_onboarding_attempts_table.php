<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * P0 onboarding finalize capability token (identity binding).
 * onboarding_id is a locator only — finalize requires hashed single-use token.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('onboarding_attempts', function (Blueprint $table) {
            $table->string('finalize_token_hash', 64)->nullable()->after('otp_verified_at');
            $table->timestamp('finalize_token_expires_at')->nullable()->after('finalize_token_hash');
            $table->timestamp('finalize_token_consumed_at')->nullable()->after('finalize_token_expires_at');
        });
    }

    public function down(): void
    {
        Schema::table('onboarding_attempts', function (Blueprint $table) {
            $table->dropColumn([
                'finalize_token_hash',
                'finalize_token_expires_at',
                'finalize_token_consumed_at',
            ]);
        });
    }
};
