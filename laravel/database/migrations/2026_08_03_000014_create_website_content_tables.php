<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('website_settings', function (Blueprint $table) {
            $table->id();
            $table->string('website_name');
            $table->string('tagline')->nullable();
            $table->string('logo')->nullable();
            $table->string('logo_dark')->nullable();
            $table->string('favicon')->nullable();
            $table->string('support_email')->nullable();
            $table->string('support_phone')->nullable();
            $table->string('whatsapp')->nullable();
            $table->text('office_address')->nullable();
            $table->text('google_maps_url')->nullable();
            $table->string('facebook')->nullable();
            $table->string('instagram')->nullable();
            $table->string('tiktok')->nullable();
            $table->string('youtube')->nullable();
            $table->string('twitter')->nullable();
            $table->string('copyright')->nullable();
            $table->boolean('maintenance_mode')->default(false);
            $table->string('timezone')->default('UTC');
            $table->string('currency')->default('IDR');
            $table->string('language')->default('id');
            $table->timestamps();
        });

        Schema::create('homepage_sections', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('slug')->unique();
            $table->string('component_type'); // hero, banner, promo, categories, product_grid, announcement, news, faq, footer
            $table->integer('display_order')->default(0);
            $table->boolean('visible')->default(true);
            $table->string('status')->default('active');
            $table->text('description')->nullable();
            $table->timestamps();
        });

        Schema::create('website_menus', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('slug')->nullable();
            $table->string('url');
            $table->string('icon')->nullable();
            $table->foreignId('parent_id')->nullable()->constrained('website_menus')->onDelete('cascade');
            $table->integer('display_order')->default(0);
            $table->boolean('visible')->default(true);
            $table->boolean('open_in_new_tab')->default(false);
            $table->timestamps();
        });

        Schema::create('static_pages', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('slug')->unique();
            $table->text('content');
            $table->string('seo_title')->nullable();
            $table->text('seo_description')->nullable();
            $table->string('status')->default('draft');
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('static_pages');
        Schema::dropIfExists('website_menus');
        Schema::dropIfExists('homepage_sections');
        Schema::dropIfExists('website_settings');
    }
};
