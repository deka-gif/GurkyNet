<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sprint 18 — Legal consent, tax scaffold, legal review flag (Bagian 22/27/28).
 * Additive + reversible. No historical deletion.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('policy_acceptances')) {
            Schema::create('policy_acceptances', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->string('document_type', 64); // privacy_policy|terms_conditions|refund_policy
                $table->unsignedInteger('policy_version');
                $table->timestamp('accepted_at');
                $table->timestamps();

                $table->index(['user_id', 'document_type']);
                $table->unique(['user_id', 'document_type', 'policy_version'], 'uniq_policy_accept_user_type_ver');
            });
        }

        if (Schema::hasTable('legal_documents') && ! Schema::hasColumn('legal_documents', 'legal_review_status')) {
            Schema::table('legal_documents', function (Blueprint $table) {
                // not_binding until lawyer review — Sprint 18 locked decision
                $table->string('legal_review_status', 64)->default('pending_legal_review')->after('status');
            });
        }

        if (Schema::hasTable('transactions')) {
            Schema::table('transactions', function (Blueprint $table) {
                if (! Schema::hasColumn('transactions', 'tax_ppn_amount')) {
                    $table->decimal('tax_ppn_amount', 15, 2)->nullable()->after('admin_fee');
                }
                if (! Schema::hasColumn('transactions', 'tax_metadata')) {
                    $table->json('tax_metadata')->nullable()->after('tax_ppn_amount');
                }
            });
        }

        if (! Schema::hasTable('tax_settings')) {
            Schema::create('tax_settings', function (Blueprint $table) {
                $table->id();
                $table->boolean('pkp_enabled')->default(false);
                $table->decimal('ppn_rate', 8, 4)->nullable(); // MUST stay null until tax consultant decision
                $table->json('metadata')->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('policy_acceptances');

        if (Schema::hasTable('legal_documents') && Schema::hasColumn('legal_documents', 'legal_review_status')) {
            Schema::table('legal_documents', function (Blueprint $table) {
                $table->dropColumn('legal_review_status');
            });
        }

        if (Schema::hasTable('transactions')) {
            Schema::table('transactions', function (Blueprint $table) {
                if (Schema::hasColumn('transactions', 'tax_metadata')) {
                    $table->dropColumn('tax_metadata');
                }
                if (Schema::hasColumn('transactions', 'tax_ppn_amount')) {
                    $table->dropColumn('tax_ppn_amount');
                }
            });
        }

        Schema::dropIfExists('tax_settings');
    }
};
