<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_providers', function (Blueprint $table) {
            if (! Schema::hasColumn('product_providers', 'provider_profile')) {
                $table->json('provider_profile')->nullable()->after('balance');
            }
        });
    }

    public function down(): void
    {
        Schema::table('product_providers', function (Blueprint $table) {
            if (Schema::hasColumn('product_providers', 'provider_profile')) {
                $table->dropColumn('provider_profile');
            }
        });
    }
};
