<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->index('payment_method', 'transactions_payment_method_index');
        });

        Schema::table('banner_promotions', function (Blueprint $table) {
            $table->index(['type', 'is_active'], 'banner_promotions_type_is_active_index');
        });

        Schema::table('activity_logs', function (Blueprint $table) {
            $table->index('activity', 'activity_logs_activity_index');
        });

        Schema::table('payment_histories', function (Blueprint $table) {
            $table->index('status', 'payment_histories_status_index');
            $table->index('gateway', 'payment_histories_gateway_index');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->index('provider_id', 'products_provider_id_index');
        });
    }

    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropIndex('transactions_payment_method_index');
        });
        Schema::table('banner_promotions', function (Blueprint $table) {
            $table->dropIndex('banner_promotions_type_is_active_index');
        });
        Schema::table('activity_logs', function (Blueprint $table) {
            $table->dropIndex('activity_logs_activity_index');
        });
        Schema::table('payment_histories', function (Blueprint $table) {
            $table->dropIndex('payment_histories_status_index');
            $table->dropIndex('payment_histories_gateway_index');
        });
        Schema::table('products', function (Blueprint $table) {
            $table->dropIndex('products_provider_id_index');
        });
    }
};
