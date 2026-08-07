<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('product_providers', 'partner_status')) {
            Schema::table('product_providers', function (Blueprint $table) {
                $table->string('partner_status', 20)->default('online')->after('is_active');
                $table->index('partner_status');
            });
        }

        if (Schema::hasColumn('product_providers', 'partner_status')) {
            DB::table('product_providers')
                ->where('is_active', false)
                ->update(['partner_status' => 'offline']);

            DB::table('product_providers')
                ->where('is_active', true)
                ->where(function ($q) {
                    $q->whereNull('partner_status')->orWhere('partner_status', '');
                })
                ->update(['partner_status' => 'online']);
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('product_providers', 'partner_status')) {
            Schema::table('product_providers', function (Blueprint $table) {
                $table->dropIndex(['partner_status']);
                $table->dropColumn('partner_status');
            });
        }
    }
};
