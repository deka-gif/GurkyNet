<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sprint 7.3 — Legal Center documents with draft + version history.
 */
return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('legal_documents')) {
            Schema::create('legal_documents', function (Blueprint $table) {
                $table->id();
                $table->string('type')->unique(); // privacy_policy|terms_conditions|refund_policy
                $table->string('slug')->unique();
                $table->string('title');
                $table->longText('content')->nullable(); // published HTML
                $table->longText('draft_content')->nullable();
                $table->boolean('is_dirty')->default(false);
                $table->string('seo_title')->nullable();
                $table->text('seo_description')->nullable();
                $table->string('seo_keywords')->nullable();
                $table->string('canonical_url')->nullable();
                $table->string('og_image')->nullable();
                $table->string('status')->default('draft'); // draft|published
                $table->unsignedSmallInteger('estimated_reading_minutes')->nullable();
                $table->unsignedInteger('version_number')->default(0);
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('published_at')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('legal_document_versions')) {
            Schema::create('legal_document_versions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('legal_document_id')->constrained('legal_documents')->cascadeOnDelete();
                $table->unsignedInteger('version_number');
                $table->string('label')->nullable();
                $table->string('title');
                $table->longText('content')->nullable();
                $table->string('seo_title')->nullable();
                $table->text('seo_description')->nullable();
                $table->string('seo_keywords')->nullable();
                $table->string('source')->default('publish'); // publish|rollback
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('published_at')->nullable();
                $table->timestamps();

                $table->unique(['legal_document_id', 'version_number']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('legal_document_versions');
        Schema::dropIfExists('legal_documents');
    }
};
