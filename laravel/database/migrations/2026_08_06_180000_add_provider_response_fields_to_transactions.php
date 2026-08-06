<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            if (!Schema::hasColumn('transactions', 'provider_response')) {
                $table->json('provider_response')->nullable()->after('provider_ref');
            }
            if (!Schema::hasColumn('transactions', 'provider_transaction_time')) {
                $table->timestamp('provider_transaction_time')->nullable()->after('provider_response');
            }
        });
    }

    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            if (Schema::hasColumn('transactions', 'provider_transaction_time')) {
                $table->dropColumn('provider_transaction_time');
            }
            if (Schema::hasColumn('transactions', 'provider_response')) {
                $table->dropColumn('provider_response');
            }
        });
    }
};
