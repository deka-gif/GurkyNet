<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sprint 7.1 — CMS-driven homepage section content fields + SEO on settings.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('homepage_sections', function (Blueprint $table) {
            if (! Schema::hasColumn('homepage_sections', 'subtitle')) {
                $table->string('subtitle')->nullable()->after('title');
            }
            if (! Schema::hasColumn('homepage_sections', 'background_color')) {
                $table->string('background_color', 32)->nullable()->after('description');
            }
            if (! Schema::hasColumn('homepage_sections', 'text_color')) {
                $table->string('text_color', 32)->nullable()->after('background_color');
            }
            if (! Schema::hasColumn('homepage_sections', 'button_label')) {
                $table->string('button_label')->nullable()->after('text_color');
            }
            if (! Schema::hasColumn('homepage_sections', 'button_url')) {
                $table->string('button_url')->nullable()->after('button_label');
            }
            if (! Schema::hasColumn('homepage_sections', 'animation')) {
                $table->string('animation', 32)->nullable()->default('fade')->after('button_url');
            }
            if (! Schema::hasColumn('homepage_sections', 'content_items')) {
                $table->json('content_items')->nullable()->after('animation');
            }
        });

        Schema::table('website_settings', function (Blueprint $table) {
            if (! Schema::hasColumn('website_settings', 'seo_title')) {
                $table->string('seo_title')->nullable()->after('language');
            }
            if (! Schema::hasColumn('website_settings', 'seo_description')) {
                $table->text('seo_description')->nullable()->after('seo_title');
            }
            if (! Schema::hasColumn('website_settings', 'seo_keywords')) {
                $table->string('seo_keywords')->nullable()->after('seo_description');
            }
        });
    }

    public function down(): void
    {
        Schema::table('homepage_sections', function (Blueprint $table) {
            foreach (['subtitle', 'background_color', 'text_color', 'button_label', 'button_url', 'animation', 'content_items'] as $col) {
                if (Schema::hasColumn('homepage_sections', $col)) {
                    $table->dropColumn($col);
                }
            }
        });

        Schema::table('website_settings', function (Blueprint $table) {
            foreach (['seo_title', 'seo_description', 'seo_keywords'] as $col) {
                if (Schema::hasColumn('website_settings', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
