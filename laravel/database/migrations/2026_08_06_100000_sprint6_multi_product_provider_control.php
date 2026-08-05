<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Sprint 6 — Multi Product Provider Control Center schema.
 * Extends product_providers; adds SKU mapping offers + provider attempt logs.
 * Does not alter Digiflazz sync ownership of master products.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('product_providers', function (Blueprint $table) {
            $table->unsignedInteger('priority')->default(100)->after('sort_order');
            $table->string('logo')->nullable()->after('name');
            $table->string('api_status', 32)->default('unknown')->after('is_active'); // online|offline|degraded|unknown
            $table->string('health_color', 16)->default('yellow')->after('api_status'); // green|yellow|red
            $table->decimal('balance', 18, 2)->nullable()->after('health_color');
            $table->unsignedInteger('product_count')->default(0)->after('balance');
            $table->timestamp('last_sync_at')->nullable()->after('product_count');
            $table->timestamp('last_health_check_at')->nullable()->after('last_sync_at');
            $table->unsignedInteger('avg_response_ms')->nullable()->after('last_health_check_at');
            $table->decimal('success_rate', 5, 2)->nullable()->after('avg_response_ms');
            $table->unsignedInteger('failed_transactions_today')->default(0)->after('success_rate');
            $table->unsignedInteger('transactions_today')->default(0)->after('failed_transactions_today');
            $table->timestamp('last_success_at')->nullable()->after('transactions_today');
            $table->timestamp('last_failure_at')->nullable()->after('last_success_at');
            $table->text('last_error')->nullable()->after('last_failure_at');
        });

        // Digiflazz = priority 1, VIP = priority 2
        DB::table('product_providers')->where('code', 'digiflazz')->update(['priority' => 1, 'api_status' => 'online', 'health_color' => 'green']);
        DB::table('product_providers')->where('code', 'vip')->update(['priority' => 2, 'api_status' => 'unknown', 'health_color' => 'yellow']);

        Schema::create('product_provider_skus', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->foreignId('product_provider_id')->constrained('product_providers')->cascadeOnDelete();
            $table->string('provider_sku'); // Digiflazz buyer_sku_code / VIP SKU
            $table->decimal('base_price', 15, 2)->default(0);
            $table->boolean('is_preferred')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['product_id', 'product_provider_id'], 'pps_product_provider_unique');
            $table->unique(['product_provider_id', 'provider_sku'], 'pps_provider_sku_unique');
            $table->index(['product_provider_id', 'is_active']);
        });

        // Backfill Digiflazz offers from existing master products (no SKU duplication).
        $digiflazzId = DB::table('product_providers')->where('code', 'digiflazz')->value('id');
        if ($digiflazzId) {
            $now = now();
            $rows = DB::table('products')
                ->whereNull('deleted_at')
                ->select('id', 'sku_code', 'base_price', 'product_provider_id')
                ->get();

            foreach ($rows as $product) {
                DB::table('product_provider_skus')->updateOrInsert(
                    [
                        'product_id' => $product->id,
                        'product_provider_id' => $digiflazzId,
                    ],
                    [
                        'provider_sku' => $product->sku_code,
                        'base_price' => $product->base_price,
                        'is_preferred' => true,
                        'is_active' => true,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]
                );
            }

            DB::table('product_providers')->where('id', $digiflazzId)->update([
                'product_count' => DB::table('product_provider_skus')->where('product_provider_id', $digiflazzId)->count(),
            ]);
        }

        Schema::create('product_provider_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_provider_id')->nullable()->constrained('product_providers')->nullOnDelete();
            $table->unsignedBigInteger('transaction_id')->nullable()->index();
            $table->string('event_type', 64); // health_check|sync|fulfill_attempt|failover|enable|disable|set_primary
            $table->string('selected_provider_code', 50)->nullable();
            $table->string('fallback_provider_code', 50)->nullable();
            $table->string('reason')->nullable();
            $table->unsignedInteger('response_time_ms')->nullable();
            $table->unsignedTinyInteger('attempt')->default(1);
            $table->boolean('success')->nullable();
            $table->text('error_message')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['product_provider_id', 'event_type']);
            $table->index(['created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_provider_logs');
        Schema::dropIfExists('product_provider_skus');

        Schema::table('product_providers', function (Blueprint $table) {
            $table->dropColumn([
                'priority',
                'logo',
                'api_status',
                'health_color',
                'balance',
                'product_count',
                'last_sync_at',
                'last_health_check_at',
                'avg_response_ms',
                'success_rate',
                'failed_transactions_today',
                'transactions_today',
                'last_success_at',
                'last_failure_at',
                'last_error',
            ]);
        });
    }
};
