<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_provider_skus', function (Blueprint $table) {
            if (! Schema::hasColumn('product_provider_skus', 'provider_meta')) {
                $table->json('provider_meta')->nullable()->after('provider_status');
            }
        });
    }

    public function down(): void
    {
        Schema::table('product_provider_skus', function (Blueprint $table) {
            if (Schema::hasColumn('product_provider_skus', 'provider_meta')) {
                $table->dropColumn('provider_meta');
            }
        });
    }
};
