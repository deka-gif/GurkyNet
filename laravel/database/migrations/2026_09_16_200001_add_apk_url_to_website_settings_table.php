<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * FR-MKT01 — URL unduhan APK resmi untuk tombol Download Aplikasi di landing.
 * Additive + reversible; reuse website_settings (UI/API already map apkUrl ↔ apk_url).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('website_settings', function (Blueprint $table) {
            if (! Schema::hasColumn('website_settings', 'apk_url')) {
                $table->string('apk_url', 500)->nullable()->after('twitter');
            }
        });
    }

    public function down(): void
    {
        Schema::table('website_settings', function (Blueprint $table) {
            if (Schema::hasColumn('website_settings', 'apk_url')) {
                $table->dropColumn('apk_url');
            }
        });
    }
};
