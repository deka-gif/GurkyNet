<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * SRS Bagian 30 — API H2H Mitra (FR-API-01..11).
 * Additive + reversible. Does not delete wallet/transaction history.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('api_partners', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete(); // portal login
            $table->string('nama_usaha', 255);
            $table->string('pic_name', 255);
            $table->string('pic_contact', 255);
            $table->string('tier', 64)->default('standard'); // partner_tier code
            $table->string('status', 32)->default('pending'); // pending|approved|rejected|suspended
            $table->unsignedInteger('rate_limit_per_minute')->default(60);
            $table->json('ip_whitelist')->nullable(); // optional
            $table->text('volume_notes')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->string('review_note', 255)->nullable();
            $table->timestamps();

            $table->index(['status', 'tier']);
            $table->index('user_id');
        });

        Schema::create('api_credentials', function (Blueprint $table) {
            $table->id();
            $table->foreignId('partner_id')->constrained('api_partners')->cascadeOnDelete();
            $table->string('api_key', 64);
            $table->text('secret_encrypted'); // APP_KEY encryption — needed for HMAC (not plaintext)
            $table->string('secret_hint', 16)->nullable(); // last 4 for UI
            $table->string('callback_url', 500)->nullable();
            $table->boolean('is_sandbox')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamp('revoked_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique('api_key');
            $table->index(['partner_id', 'is_active', 'is_sandbox']);
        });

        Schema::create('partner_wallets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('partner_id')->constrained('api_partners')->cascadeOnDelete();
            $table->decimal('balance', 15, 2)->default(0);
            $table->string('status', 32)->default('active');
            $table->timestamps();

            $table->unique('partner_id');
        });

        Schema::create('partner_wallet_mutations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('partner_wallet_id')->constrained('partner_wallets')->cascadeOnDelete();
            $table->string('type', 32); // deposit|purchase|refund|adjustment
            $table->decimal('amount', 15, 2);
            $table->string('reference_id', 128)->nullable();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['partner_wallet_id', 'type']);
            $table->index('reference_id');
        });

        Schema::create('partner_deposit_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('partner_id')->constrained('api_partners')->cascadeOnDelete();
            $table->decimal('amount', 15, 2);
            $table->string('status', 32)->default('pending'); // pending|approved|rejected
            $table->string('note', 255)->nullable();
            $table->string('idempotency_key', 128)->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->unique(['partner_id', 'idempotency_key']);
            $table->index(['status', 'created_at']);
        });

        Schema::create('partner_product_prices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->restrictOnDelete();
            $table->string('partner_tier', 64);
            $table->decimal('sell_price', 15, 2);
            $table->boolean('is_current')->default(true);
            $table->timestamp('effective_from');
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['product_id', 'partner_tier', 'is_current']);
        });

        Schema::create('api_request_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('partner_id')->nullable()->constrained('api_partners')->nullOnDelete();
            $table->string('endpoint', 128);
            $table->string('method', 16)->default('POST');
            $table->string('request_hash', 64)->nullable();
            $table->string('idempotency_key', 128)->nullable();
            $table->unsignedSmallInteger('response_status')->nullable();
            $table->unsignedInteger('latency_ms')->nullable();
            $table->string('error_class', 64)->nullable();
            $table->boolean('sandbox')->default(false);
            $table->timestamps();

            $table->index(['partner_id', 'created_at']);
            $table->index(['partner_id', 'idempotency_key']);
        });

        Schema::create('api_webhook_deliveries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('partner_id')->constrained('api_partners')->cascadeOnDelete();
            $table->foreignId('transaction_id')->constrained('transactions')->cascadeOnDelete();
            $table->string('event_key', 128); // partner_id:tx_id:status for idempotency
            $table->json('payload');
            $table->unsignedSmallInteger('http_status_response')->nullable();
            $table->unsignedTinyInteger('retry_count')->default(0);
            $table->string('status', 32)->default('pending'); // pending|delivered|failed
            $table->timestamp('next_retry_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamps();

            $table->unique('event_key');
            $table->index(['status', 'next_retry_at']);
        });

        Schema::create('partner_abuse_flags', function (Blueprint $table) {
            $table->id();
            $table->foreignId('partner_id')->nullable()->constrained('api_partners')->nullOnDelete();
            $table->string('signal', 64);
            $table->json('evidence')->nullable();
            $table->string('status', 32)->default('flagged');
            $table->timestamp('detected_at');
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['partner_id', 'status']);
        });

        if (Schema::hasTable('transactions')) {
            Schema::table('transactions', function (Blueprint $table) {
                if (! Schema::hasColumn('transactions', 'channel')) {
                    $table->string('channel', 32)->default('app')->after('payment_method');
                    $table->index('channel');
                }
                if (! Schema::hasColumn('transactions', 'partner_id')) {
                    $table->unsignedBigInteger('partner_id')->nullable()->after('channel');
                    $table->index('partner_id');
                }
                if (! Schema::hasColumn('transactions', 'partner_ref')) {
                    $table->string('partner_ref', 128)->nullable()->after('partner_id');
                    $table->index(['partner_id', 'partner_ref']);
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('transactions')) {
            Schema::table('transactions', function (Blueprint $table) {
                if (Schema::hasColumn('transactions', 'partner_ref')) {
                    $table->dropColumn('partner_ref');
                }
                if (Schema::hasColumn('transactions', 'partner_id')) {
                    $table->dropColumn('partner_id');
                }
                if (Schema::hasColumn('transactions', 'channel')) {
                    $table->dropColumn('channel');
                }
            });
        }

        Schema::dropIfExists('partner_abuse_flags');
        Schema::dropIfExists('api_webhook_deliveries');
        Schema::dropIfExists('api_request_logs');
        Schema::dropIfExists('partner_product_prices');
        Schema::dropIfExists('partner_deposit_requests');
        Schema::dropIfExists('partner_wallet_mutations');
        Schema::dropIfExists('partner_wallets');
        Schema::dropIfExists('api_credentials');
        Schema::dropIfExists('api_partners');
    }
};
