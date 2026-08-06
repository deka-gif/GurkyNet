<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('otp_codes', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable()->after('id')->constrained('users')->nullOnDelete();
            $table->string('channel')->default('phone')->after('action');
            $table->unsignedInteger('attempt_count')->default(0)->after('is_used');
            $table->unsignedInteger('max_attempts')->default(5)->after('attempt_count');
            $table->timestamp('resend_available_at')->nullable()->after('expires_at');
            $table->json('meta')->nullable()->after('resend_available_at');

            $table->index(['phone_number', 'action', 'channel']);
        });
    }

    public function down(): void
    {
        Schema::table('otp_codes', function (Blueprint $table) {
            $table->dropConstrainedForeignId('user_id');
            $table->dropIndex(['phone_number', 'action', 'channel']);
            $table->dropColumn([
                'channel',
                'attempt_count',
                'max_attempts',
                'resend_available_at',
                'meta',
            ]);
        });
    }
};
