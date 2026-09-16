<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * FR-FIN-10 — Alokasi otomatis pendapatan (admin_fee + margin) ke kategori %.
 * Additive + reversible. Does not backfill historical transactions.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('revenue_allocation_categories', function (Blueprint $table) {
            $table->id();
            $table->string('code', 64);
            $table->string('name', 120);
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique('code');
            $table->index(['is_active', 'sort_order']);
        });

        Schema::create('revenue_allocation_rule_sets', function (Blueprint $table) {
            $table->id();
            $table->boolean('is_current')->default(false);
            $table->timestamp('effective_from');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('reason', 255)->nullable();
            $table->timestamps();

            $table->index(['is_current', 'effective_from']);
        });

        Schema::create('revenue_allocation_rule_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('rule_set_id')->constrained('revenue_allocation_rule_sets')->cascadeOnDelete();
            $table->foreignId('category_id')->constrained('revenue_allocation_categories')->restrictOnDelete();
            $table->decimal('percentage', 8, 4);
            $table->timestamps();

            $table->unique(['rule_set_id', 'category_id'], 'rev_alloc_rule_lines_set_cat_uq');
        });

        Schema::create('revenue_allocation_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('transaction_id')->constrained('transactions')->restrictOnDelete();
            $table->foreignId('rule_set_id')->nullable()->constrained('revenue_allocation_rule_sets')->nullOnDelete();
            $table->decimal('admin_fee_component', 15, 2)->default(0);
            $table->decimal('margin_component', 15, 2)->default(0);
            $table->decimal('gross_allocable', 15, 2)->default(0);
            $table->string('status', 32); // posted|reversed|skipped
            $table->string('skip_reason', 255)->nullable();
            $table->timestamp('posted_at')->nullable();
            $table->timestamp('reversed_at')->nullable();
            $table->string('reverse_reason', 255)->nullable();
            $table->string('refund_reference', 64)->nullable();
            $table->timestamps();

            $table->unique('transaction_id', 'rev_alloc_entries_tx_uq');
            $table->index(['status', 'posted_at']);
            $table->index('rule_set_id');
        });

        Schema::create('revenue_allocation_entry_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('entry_id')->constrained('revenue_allocation_entries')->cascadeOnDelete();
            $table->foreignId('category_id')->constrained('revenue_allocation_categories')->restrictOnDelete();
            $table->decimal('percentage_snapshot', 8, 4);
            $table->decimal('amount', 15, 2);
            $table->timestamps();

            $table->unique(['entry_id', 'category_id'], 'rev_alloc_entry_lines_entry_cat_uq');
            $table->index('category_id');
        });

        // Default categories + initial current rule set (FR-FIN-10 go-live defaults).
        $now = now();
        $categories = [
            ['code' => 'vps_server', 'name' => 'VPS / Server', 'sort_order' => 10, 'pct' => 15],
            ['code' => 'gaji', 'name' => 'Gaji', 'sort_order' => 20, 'pct' => 25],
            ['code' => 'cadangan_pajak', 'name' => 'Cadangan Pajak', 'sort_order' => 30, 'pct' => 10],
            ['code' => 'isi_ulang_digiflazz', 'name' => 'Isi Ulang Saldo Digiflazz', 'sort_order' => 40, 'pct' => 20],
            ['code' => 'dana_darurat', 'name' => 'Dana Darurat', 'sort_order' => 50, 'pct' => 10],
            ['code' => 'pengembangan_aplikasi', 'name' => 'Pengembangan Aplikasi', 'sort_order' => 60, 'pct' => 10],
            ['code' => 'keuntungan_pribadi', 'name' => 'Keuntungan Pribadi', 'sort_order' => 70, 'pct' => 10],
        ];

        $catIds = [];
        foreach ($categories as $c) {
            $id = DB::table('revenue_allocation_categories')->insertGetId([
                'code' => $c['code'],
                'name' => $c['name'],
                'sort_order' => $c['sort_order'],
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            $catIds[$c['code']] = ['id' => $id, 'pct' => $c['pct']];
        }

        $ruleSetId = DB::table('revenue_allocation_rule_sets')->insertGetId([
            'is_current' => true,
            'effective_from' => $now,
            'created_by' => null,
            'reason' => 'FR-FIN-10 default initial rule set (go-live)',
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        foreach ($catIds as $row) {
            DB::table('revenue_allocation_rule_lines')->insert([
                'rule_set_id' => $ruleSetId,
                'category_id' => $row['id'],
                'percentage' => $row['pct'],
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('revenue_allocation_entry_lines');
        Schema::dropIfExists('revenue_allocation_entries');
        Schema::dropIfExists('revenue_allocation_rule_lines');
        Schema::dropIfExists('revenue_allocation_rule_sets');
        Schema::dropIfExists('revenue_allocation_categories');
    }
};
