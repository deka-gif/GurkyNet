<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('products', 'ops_status')) {
            Schema::table('products', function (Blueprint $table) {
                $table->string('ops_status', 20)->default('active')->after('status');
                $table->index('ops_status');
            });
        }

        // Backfill legacy MAINTENANCE SKU convention into ops_status.
        if (Schema::hasColumn('products', 'ops_status')) {
            DB::table('products')
                ->where('sku_code', 'like', '%MAINTENANCE%')
                ->update(['ops_status' => 'maintenance']);

            DB::table('products')
                ->where('status', false)
                ->where('ops_status', 'active')
                ->where('sku_code', 'not like', '%MAINTENANCE%')
                ->update(['ops_status' => 'inactive']);
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('products', 'ops_status')) {
            Schema::table('products', function (Blueprint $table) {
                $table->dropIndex(['ops_status']);
                $table->dropColumn('ops_status');
            });
        }
    }
};
