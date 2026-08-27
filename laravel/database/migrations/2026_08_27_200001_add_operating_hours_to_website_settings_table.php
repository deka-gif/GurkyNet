<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * FR-MKT01 — jam operasional identitas perusahaan (SRS Bagian 4.2).
 * Additive + reversible; reuse website_settings (no second settings system).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('website_settings', function (Blueprint $table) {
            if (! Schema::hasColumn('website_settings', 'operating_hours')) {
                $table->string('operating_hours', 255)->nullable()->after('office_address');
            }
        });
    }

    public function down(): void
    {
        Schema::table('website_settings', function (Blueprint $table) {
            if (Schema::hasColumn('website_settings', 'operating_hours')) {
                $table->dropColumn('operating_hours');
            }
        });
    }
};
