<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Account self-deletion — 30-day pending_deletion grace (Owner-approved).
 * SoftDeletes deleted_at is set only on purge execution, not on request.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('deletion_status', 32)->nullable()->after('status');
            $table->timestamp('deletion_requested_at')->nullable()->after('deletion_status');
            $table->timestamp('deletion_scheduled_for')->nullable()->after('deletion_requested_at');
            $table->string('deletion_reason_code', 64)->nullable()->after('deletion_scheduled_for');
            $table->text('deletion_reason_text')->nullable()->after('deletion_reason_code');
            $table->timestamp('deletion_cancelled_at')->nullable()->after('deletion_reason_text');
            $table->timestamp('deletion_executed_at')->nullable()->after('deletion_cancelled_at');
            $table->timestamp('deletion_reminder_h7_sent_at')->nullable()->after('deletion_executed_at');
            $table->timestamp('deletion_reminder_h1_sent_at')->nullable()->after('deletion_reminder_h7_sent_at');

            $table->index(['deletion_status', 'deletion_scheduled_for'], 'users_deletion_schedule_idx');
        });

        Schema::create('account_deletion_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('event', 32); // requested|cancelled|reminded_h7|reminded_h1|executed
            $table->string('actor', 32)->default('customer'); // customer|system
            $table->json('payload')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'event']);
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('account_deletion_events');

        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex('users_deletion_schedule_idx');
            $table->dropColumn([
                'deletion_status',
                'deletion_requested_at',
                'deletion_scheduled_for',
                'deletion_reason_code',
                'deletion_reason_text',
                'deletion_cancelled_at',
                'deletion_executed_at',
                'deletion_reminder_h7_sent_at',
                'deletion_reminder_h1_sent_at',
            ]);
        });
    }
};
