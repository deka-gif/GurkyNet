<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // 1. Website Settings table
        Schema::table('website_settings', function (Blueprint $table) {
            $table->foreignId('logo_media_id')->nullable()->constrained('media')->onDelete('set null')->after('favicon');
            $table->foreignId('logo_dark_media_id')->nullable()->constrained('media')->onDelete('set null')->after('logo_media_id');
            $table->foreignId('favicon_media_id')->nullable()->constrained('media')->onDelete('set null')->after('logo_dark_media_id');
        });

        // 2. Homepage Sections table
        Schema::table('homepage_sections', function (Blueprint $table) {
            $table->foreignId('hero_background_media_id')->nullable()->constrained('media')->onDelete('set null')->after('description');
            $table->foreignId('hero_illustration_media_id')->nullable()->constrained('media')->onDelete('set null')->after('hero_background_media_id');
            $table->foreignId('hero_mobile_image_media_id')->nullable()->constrained('media')->onDelete('set null')->after('hero_illustration_media_id');
        });

        // 3. Banner Promotions table
        Schema::table('banner_promotions', function (Blueprint $table) {
            $table->foreignId('image_media_id')->nullable()->constrained('media')->onDelete('set null')->after('image_url');
            $table->foreignId('mobile_image_media_id')->nullable()->constrained('media')->onDelete('set null')->after('image_media_id');
        });

        // 4. Notifications (Announcements) table
        Schema::table('notifications', function (Blueprint $table) {
            $table->foreignId('cover_media_id')->nullable()->constrained('media')->onDelete('set null')->after('type');
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropConstrainedForeignId('cover_media_id');
        });

        Schema::table('banner_promotions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('image_media_id');
            $table->dropConstrainedForeignId('mobile_image_media_id');
        });

        Schema::table('homepage_sections', function (Blueprint $table) {
            $table->dropConstrainedForeignId('hero_background_media_id');
            $table->dropConstrainedForeignId('hero_illustration_media_id');
            $table->dropConstrainedForeignId('hero_mobile_image_media_id');
        });

        Schema::table('website_settings', function (Blueprint $table) {
            $table->dropConstrainedForeignId('logo_media_id');
            $table->dropConstrainedForeignId('logo_dark_media_id');
            $table->dropConstrainedForeignId('favicon_media_id');
        });
    }
};
