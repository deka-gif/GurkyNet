<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // 1. payment_histories
        Schema::create('payment_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('transaction_id')->constrained('transactions')->onDelete('cascade');
            $table->string('gateway');
            $table->string('payment_code')->nullable();
            $table->json('payload')->nullable();
            $table->json('response')->nullable();
            $table->string('status');
            $table->timestamps();

            $table->index('transaction_id');
        });

        // 2. midtrans_transactions
        Schema::create('midtrans_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('transaction_id')->constrained('transactions')->onDelete('cascade');
            $table->string('order_id')->unique();
            $table->string('snap_token')->nullable();
            $table->string('payment_type')->nullable();
            $table->decimal('gross_amount', 15, 2);
            $table->string('transaction_status');
            $table->json('raw_notification')->nullable();
            $table->timestamps();

            $table->index('transaction_id');
            $table->index('order_id');
        });

        // 3. digiflazz_transactions
        Schema::create('digiflazz_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('transaction_id')->constrained('transactions')->onDelete('cascade');
            $table->string('ref_id')->unique();
            $table->string('buyer_sku_code');
            $table->string('customer_no');
            $table->string('sn')->nullable();
            $table->string('digiflazz_status')->default('pending');
            $table->json('raw_response')->nullable();
            $table->timestamps();

            $table->index('transaction_id');
            $table->index('ref_id');
        });

        // 4. otp_codes
        Schema::create('otp_codes', function (Blueprint $table) {
            $table->id();
            $table->string('phone_number');
            $table->string('code');
            $table->string('action'); // registration, pin_reset, password_reset, etc.
            $table->boolean('is_used')->default(false);
            $table->timestamp('expires_at');
            $table->timestamps();

            $table->index(['phone_number', 'code']);
        });

        // 5. password_resets
        if (!Schema::hasTable('password_resets')) {
            Schema::create('password_resets', function (Blueprint $table) {
                $table->string('email')->index();
                $table->string('token');
                $table->timestamp('created_at')->nullable();
            });
        }

        // 6. login_logs
        Schema::create('login_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamp('logged_at');

            $table->index('user_id');
        });

        // 7. activity_logs
        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->onDelete('cascade');
            $table->string('activity');
            $table->json('payload')->nullable();
            $table->timestamps();

            $table->index('user_id');
        });

        // 8. banner_promotions
        Schema::create('banner_promotions', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('image_url');
            $table->string('redirect_url')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index('is_active');
        });

        // 9. notifications
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->text('message');
            $table->string('type')->default('broadcast'); // broadcast, transaction, system
            $table->timestamps();
        });

        // 10. user_notifications
        Schema::create('user_notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('notification_id')->constrained('notifications')->onDelete('cascade');
            $table->boolean('is_read')->default(false);
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index('user_id');
            $table->index('is_read');
        });

        // 11. settings
        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->text('value')->nullable();
            $table->timestamps();

            $table->index('key');
        });

        // 12. faq
        Schema::create('faq', function (Blueprint $table) {
            $table->id();
            $table->text('question');
            $table->text('answer');
            $table->integer('order')->default(0);
            $table->timestamps();
        });

        // 13. pages
        Schema::create('pages', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('slug')->unique();
            $table->longText('content');
            $table->timestamps();

            $table->index('slug');
        });

        // 14. apk_versions
        Schema::create('apk_versions', function (Blueprint $table) {
            $table->id();
            $table->integer('version_code');
            $table->string('version_name');
            $table->string('download_url');
            $table->boolean('is_force_update')->default(false);
            $table->text('release_notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('apk_versions');
        Schema::dropIfExists('pages');
        Schema::dropIfExists('faq');
        Schema::dropIfExists('settings');
        Schema::dropIfExists('user_notifications');
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('banner_promotions');
        Schema::dropIfExists('activity_logs');
        Schema::dropIfExists('login_logs');
        Schema::dropIfExists('password_resets');
        Schema::dropIfExists('otp_codes');
        Schema::dropIfExists('digiflazz_transactions');
        Schema::dropIfExists('midtrans_transactions');
        Schema::dropIfExists('payment_histories');
    }
};
