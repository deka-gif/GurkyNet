<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            if (!Schema::hasColumn('transactions', 'timeout_at')) {
                $table->timestamp('timeout_at')->nullable()->after('notes');
            }
            if (!Schema::hasColumn('transactions', 'provider_checked_at')) {
                $table->timestamp('provider_checked_at')->nullable()->after('timeout_at');
            }
            if (!Schema::hasColumn('transactions', 'provider_last_status')) {
                $table->string('provider_last_status', 64)->nullable()->after('provider_checked_at');
            }
            if (!Schema::hasColumn('transactions', 'fulfillment_provider_code')) {
                $table->string('fulfillment_provider_code', 64)->nullable()->after('provider_last_status');
            }
            if (!Schema::hasColumn('transactions', 'provider_sku_used')) {
                $table->string('provider_sku_used', 128)->nullable()->after('fulfillment_provider_code');
            }
            if (!Schema::hasColumn('transactions', 'provider_ref')) {
                $table->string('provider_ref', 128)->nullable()->after('provider_sku_used');
            }
            if (!Schema::hasColumn('transactions', 'refunded_at')) {
                $table->timestamp('refunded_at')->nullable()->after('provider_ref');
            }
            if (!Schema::hasColumn('transactions', 'refund_reference')) {
                $table->string('refund_reference', 128)->nullable()->after('refunded_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            foreach ([
                'timeout_at',
                'provider_checked_at',
                'provider_last_status',
                'fulfillment_provider_code',
                'provider_sku_used',
                'provider_ref',
                'refunded_at',
                'refund_reference',
            ] as $col) {
                if (Schema::hasColumn('transactions', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
