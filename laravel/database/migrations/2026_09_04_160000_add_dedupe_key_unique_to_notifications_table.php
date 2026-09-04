<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * FR-TOPUP-UX-01 — atomic final-notification idempotency.
 * Nullable unique `dedupe_key` on notifications: NULL rows (broadcast/system) unrestricted;
 * keyed finals (topup_success:{id}, etc.) are insert-or-conflict only.
 * Does not touch financial tables or existing notification rows' content.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            if (! Schema::hasColumn('notifications', 'dedupe_key')) {
                $table->string('dedupe_key', 191)->nullable()->after('payload');
            }
        });

        // Unique only on non-null keys — multiple NULL dedupe_key allowed (MySQL/SQLite/Postgres).
        Schema::table('notifications', function (Blueprint $table) {
            $sm = Schema::getConnection()->getSchemaBuilder();
            $indexes = $sm->getIndexes('notifications');
            $hasUnique = false;
            foreach ($indexes as $index) {
                if (($index['name'] ?? '') === 'notifications_dedupe_key_unique'
                    || (($index['unique'] ?? false) && ($index['columns'] ?? []) === ['dedupe_key'])) {
                    $hasUnique = true;
                    break;
                }
            }
            if (! $hasUnique) {
                $table->unique('dedupe_key');
            }
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $sm = Schema::getConnection()->getSchemaBuilder();
            $indexes = $sm->getIndexes('notifications');
            foreach ($indexes as $index) {
                if (($index['name'] ?? '') === 'notifications_dedupe_key_unique'
                    || (($index['unique'] ?? false) && ($index['columns'] ?? []) === ['dedupe_key'])) {
                    $table->dropUnique(['dedupe_key']);
                    break;
                }
            }
            if (Schema::hasColumn('notifications', 'dedupe_key')) {
                $table->dropColumn('dedupe_key');
            }
        });
    }
};
