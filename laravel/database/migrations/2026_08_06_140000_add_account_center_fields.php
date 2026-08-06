<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'avatar_path')) {
                $table->string('avatar_path')->nullable()->after('address');
            }
            if (!Schema::hasColumn('users', 'pin_updated_at')) {
                $table->timestamp('pin_updated_at')->nullable()->after('transaction_pin');
            }
        });

        Schema::table('support_tickets', function (Blueprint $table) {
            if (!Schema::hasColumn('support_tickets', 'subject')) {
                $table->string('subject')->nullable()->after('category');
            }
            if (!Schema::hasColumn('support_tickets', 'description')) {
                $table->text('description')->nullable()->after('subject');
            }
            if (!Schema::hasColumn('support_tickets', 'attachment')) {
                $table->string('attachment')->nullable()->after('description');
            }
            if (!Schema::hasColumn('support_tickets', 'closed_at')) {
                $table->timestamp('closed_at')->nullable()->after('status');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'avatar_path')) {
                $table->dropColumn('avatar_path');
            }
            if (Schema::hasColumn('users', 'pin_updated_at')) {
                $table->dropColumn('pin_updated_at');
            }
        });

        Schema::table('support_tickets', function (Blueprint $table) {
            foreach (['subject', 'description', 'attachment', 'closed_at'] as $col) {
                if (Schema::hasColumn('support_tickets', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
