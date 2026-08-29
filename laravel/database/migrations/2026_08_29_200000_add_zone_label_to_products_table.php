<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (! Schema::hasColumn('products', 'zone_label')) {
                $table->string('zone_label', 128)->nullable()->after('name');
                $table->index('zone_label');
            }
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (Schema::hasColumn('products', 'zone_label')) {
                $table->dropIndex(['zone_label']);
                $table->dropColumn('zone_label');
            }
        });
    }
};
