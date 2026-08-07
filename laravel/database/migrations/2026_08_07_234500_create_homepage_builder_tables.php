<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sprint 7.2 — Homepage Builder draft, versions, and section audit columns.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('homepage_sections', function (Blueprint $table) {
            if (! Schema::hasColumn('homepage_sections', 'created_by')) {
                $table->foreignId('created_by')->nullable()->after('hero_mobile_image_media_id')
                    ->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('homepage_sections', 'updated_by')) {
                $table->foreignId('updated_by')->nullable()->after('created_by')
                    ->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('homepage_sections', 'config')) {
                $table->json('config')->nullable()->after('content_items');
            }
        });

        if (! Schema::hasTable('homepage_builder_drafts')) {
            Schema::create('homepage_builder_drafts', function (Blueprint $table) {
                $table->id();
                $table->string('key')->default('homepage')->unique();
                $table->json('payload');
                $table->boolean('is_dirty')->default(false);
                $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('homepage_builder_versions')) {
            Schema::create('homepage_builder_versions', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('version_number');
                $table->string('label')->nullable();
                $table->json('payload');
                $table->string('source')->default('publish'); // publish|rollback
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('published_at')->nullable();
                $table->timestamps();

                $table->unique('version_number');
                $table->index('published_at');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('homepage_builder_versions');
        Schema::dropIfExists('homepage_builder_drafts');

        Schema::table('homepage_sections', function (Blueprint $table) {
            if (Schema::hasColumn('homepage_sections', 'config')) {
                $table->dropColumn('config');
            }
            if (Schema::hasColumn('homepage_sections', 'updated_by')) {
                $table->dropConstrainedForeignId('updated_by');
            }
            if (Schema::hasColumn('homepage_sections', 'created_by')) {
                $table->dropConstrainedForeignId('created_by');
            }
        });
    }
};
