<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Customer notification preferences foundation.
 * Transaction preference already exists (notify_transactions).
 * Announcement + promotion preferences prepare channel gating for later divisions.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'notify_announcements')) {
                $table->boolean('notify_announcements')->default(true)->after('notify_transactions');
            }
            if (! Schema::hasColumn('users', 'notify_promotions')) {
                $table->boolean('notify_promotions')->default(true)->after('notify_announcements');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'notify_promotions')) {
                $table->dropColumn('notify_promotions');
            }
            if (Schema::hasColumn('users', 'notify_announcements')) {
                $table->dropColumn('notify_announcements');
            }
        });
    }
};
