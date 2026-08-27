<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * SRS Bagian 18.2 / Tahap 6 — reconciliation_incidents + closing + FR-FIN-07 bank import.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reconciliation_incidents', function (Blueprint $table) {
            $table->id();
            $table->string('incident_code', 64)->unique();
            $table->string('type', 64); // internal_wallet|provider_h2h|midtrans_settlement|bank_match
            $table->string('source', 64)->nullable(); // digiflazz|vip|midtrans|wallet|{user}
            $table->unsignedBigInteger('user_id')->nullable()->index();
            $table->unsignedBigInteger('wallet_id')->nullable()->index();
            $table->decimal('expected_amount', 18, 2)->default(0);
            $table->decimal('actual_amount', 18, 2)->default(0);
            $table->decimal('variance', 18, 2)->default(0);
            $table->decimal('threshold', 18, 2)->default(50000);
            $table->string('status', 32)->default('open')->index(); // open|resolved
            $table->boolean('freeze_withdraw')->default(false);
            $table->boolean('restrict_purchase')->default(false); // only internal wallet per locked rule
            $table->boolean('system_wide_freeze')->default(false);
            $table->string('fingerprint', 191)->index(); // dedupe key
            $table->json('meta')->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('detected_at')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->unsignedBigInteger('resolved_by')->nullable();
            $table->timestamps();

            $table->index(['type', 'status']);
        });

        Schema::create('reconciliation_closings', function (Blueprint $table) {
            $table->id();
            $table->date('closing_date')->unique();
            $table->json('summary');
            $table->boolean('email_sent')->default(false);
            $table->timestamps();
        });

        Schema::create('bank_statement_imports', function (Blueprint $table) {
            $table->id();
            $table->string('import_code', 64)->unique();
            $table->string('filename', 255)->nullable();
            $table->string('status', 32)->default('imported'); // imported|processed
            $table->unsignedBigInteger('imported_by')->nullable();
            $table->unsignedInteger('line_count')->default(0);
            $table->json('meta')->nullable();
            $table->timestamps();
        });

        Schema::create('bank_statement_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bank_statement_import_id')->constrained('bank_statement_imports')->cascadeOnDelete();
            $table->date('transacted_on')->nullable();
            $table->decimal('amount', 18, 2);
            $table->string('external_reference', 191)->nullable()->index();
            $table->string('description', 500)->nullable();
            $table->string('match_status', 32)->default('unmatched')->index(); // unmatched|matched|discrepancy
            $table->string('internal_type', 64)->nullable(); // midtrans|deposit|settlement|manual
            $table->unsignedBigInteger('internal_id')->nullable();
            $table->decimal('internal_amount', 18, 2)->nullable();
            $table->text('evidence')->nullable();
            $table->unsignedBigInteger('matched_by')->nullable();
            $table->timestamp('matched_at')->nullable();
            $table->unsignedBigInteger('reconciliation_incident_id')->nullable();
            $table->timestamps();
        });

        Schema::create('gateway_reconciliation_items', function (Blueprint $table) {
            $table->id();
            $table->date('recon_date')->index();
            $table->string('source', 64); // midtrans|digiflazz|vip
            $table->string('external_reference', 191)->nullable()->index();
            $table->decimal('external_amount', 18, 2)->default(0);
            $table->decimal('internal_amount', 18, 2)->default(0);
            $table->decimal('variance', 18, 2)->default(0);
            $table->string('match_status', 32)->default('unmatched')->index();
            $table->string('internal_type', 64)->nullable();
            $table->unsignedBigInteger('internal_id')->nullable();
            $table->text('evidence')->nullable();
            $table->unsignedBigInteger('matched_by')->nullable();
            $table->timestamp('matched_at')->nullable();
            $table->unsignedBigInteger('reconciliation_incident_id')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->unique(['recon_date', 'source', 'external_reference'], 'gw_recon_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('gateway_reconciliation_items');
        Schema::dropIfExists('bank_statement_lines');
        Schema::dropIfExists('bank_statement_imports');
        Schema::dropIfExists('reconciliation_closings');
        Schema::dropIfExists('reconciliation_incidents');
    }
};
