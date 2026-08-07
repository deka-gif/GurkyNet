<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sprint 8.0 Phase 1 — Customer Support Communication Hub.
 */
return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('conversations')) {
            Schema::create('conversations', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->foreignId('assigned_agent_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('status')->default('open'); // open|waiting|assigned|closed
                $table->string('subject')->nullable();
                $table->timestamp('last_message_at')->nullable();
                $table->string('last_message_preview', 500)->nullable();
                $table->unsignedInteger('unread_user')->default(0);
                $table->unsignedInteger('unread_agent')->default(0);
                $table->foreignId('support_ticket_id')->nullable()->constrained('support_tickets')->nullOnDelete();
                $table->foreignId('transaction_id')->nullable()->constrained('transactions')->nullOnDelete();
                $table->softDeletes();
                $table->timestamps();

                $table->index(['status', 'last_message_at']);
                $table->index('user_id');
            });
        }

        if (! Schema::hasTable('chat_messages')) {
            Schema::create('chat_messages', function (Blueprint $table) {
                $table->id();
                $table->foreignId('conversation_id')->constrained('conversations')->cascadeOnDelete();
                $table->foreignId('sender_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('sender_role', 32); // user|agent|system
                $table->text('body');
                $table->string('client_message_id', 64)->nullable();
                $table->json('meta')->nullable();
                $table->timestamp('read_at')->nullable();
                $table->timestamps();

                $table->index(['conversation_id', 'created_at']);
                $table->unique(['conversation_id', 'client_message_id']);
            });
        }

        if (! Schema::hasTable('support_escalations')) {
            Schema::create('support_escalations', function (Blueprint $table) {
                $table->id();
                $table->foreignId('conversation_id')->nullable()->constrained('conversations')->nullOnDelete();
                $table->foreignId('support_ticket_id')->nullable()->constrained('support_tickets')->nullOnDelete();
                $table->foreignId('transaction_id')->nullable()->constrained('transactions')->nullOnDelete();
                $table->foreignId('from_user_id')->constrained('users')->cascadeOnDelete();
                $table->string('target_division', 32); // operations|finance|marketing
                $table->string('type', 64); // provider_issue|refund_request|feedback|other
                $table->string('title');
                $table->text('description')->nullable();
                $table->string('priority', 32)->default('Sedang');
                $table->string('status', 32)->default('open'); // open|in_progress|resolved|rejected|closed
                $table->text('resolution_note')->nullable();
                $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('resolved_at')->nullable();
                $table->timestamps();

                $table->index(['target_division', 'status']);
                $table->index('conversation_id');
            });
        }

        if (! Schema::hasTable('division_notifications')) {
            Schema::create('division_notifications', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('role', 64); // customer_support|operations|finance|marketing|owner
                $table->string('type', 64);
                $table->string('title');
                $table->text('body')->nullable();
                $table->json('payload')->nullable();
                $table->string('related_type')->nullable();
                $table->unsignedBigInteger('related_id')->nullable();
                $table->timestamp('read_at')->nullable();
                $table->timestamps();

                $table->index(['role', 'read_at']);
                $table->index(['related_type', 'related_id']);
            });
        }

        Schema::table('support_tickets', function (Blueprint $table) {
            if (! Schema::hasColumn('support_tickets', 'conversation_id')) {
                $table->foreignId('conversation_id')->nullable()->after('transaction_id')
                    ->constrained('conversations')->nullOnDelete();
            }
            if (! Schema::hasColumn('support_tickets', 'source')) {
                $table->string('source', 32)->default('manual')->after('status');
            }
        });
    }

    public function down(): void
    {
        Schema::table('support_tickets', function (Blueprint $table) {
            if (Schema::hasColumn('support_tickets', 'conversation_id')) {
                $table->dropConstrainedForeignId('conversation_id');
            }
            if (Schema::hasColumn('support_tickets', 'source')) {
                $table->dropColumn('source');
            }
        });

        Schema::dropIfExists('division_notifications');
        Schema::dropIfExists('support_escalations');
        Schema::dropIfExists('chat_messages');
        Schema::dropIfExists('conversations');
    }
};
