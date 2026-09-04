<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * FR-TOPUP-UX-01 — optional JSON payload for transaction-linked notifications
 * (transaction_id / invoice_number / dedupe_key). Reversible; no financial tables touched.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            if (! Schema::hasColumn('notifications', 'payload')) {
                $table->json('payload')->nullable()->after('type');
            }
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            if (Schema::hasColumn('notifications', 'payload')) {
                $table->dropColumn('payload');
            }
        });
    }
};
