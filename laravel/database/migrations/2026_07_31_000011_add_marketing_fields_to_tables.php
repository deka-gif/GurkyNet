<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('banner_promotions', function (Blueprint $table) {
            if (!Schema::hasColumn('banner_promotions', 'type')) {
                $table->string('type')->default('banner')->after('id');
            }
            if (!Schema::hasColumn('banner_promotions', 'code')) {
                $table->string('code')->nullable()->after('title');
            }
            if (!Schema::hasColumn('banner_promotions', 'description')) {
                $table->text('description')->nullable()->after('code');
            }
            if (!Schema::hasColumn('banner_promotions', 'discount_amount')) {
                $table->decimal('discount_amount', 12, 2)->default(0)->after('description');
            }
            if (!Schema::hasColumn('banner_promotions', 'discount_type')) {
                $table->string('discount_type')->default('fixed')->after('discount_amount');
            }
            if (!Schema::hasColumn('banner_promotions', 'min_transaction')) {
                $table->decimal('min_transaction', 12, 2)->default(0)->after('discount_type');
            }
            if (!Schema::hasColumn('banner_promotions', 'quota')) {
                $table->integer('quota')->default(100)->after('min_transaction');
            }
            if (!Schema::hasColumn('banner_promotions', 'used_count')) {
                $table->integer('used_count')->default(0)->after('quota');
            }
            if (!Schema::hasColumn('banner_promotions', 'deleted_at')) {
                $table->softDeletes()->after('is_active');
            }
        });

        Schema::table('notifications', function (Blueprint $table) {
            if (!Schema::hasColumn('notifications', 'is_active')) {
                $table->boolean('is_active')->default(true)->after('type');
            }
            if (!Schema::hasColumn('notifications', 'deleted_at')) {
                $table->softDeletes()->after('is_active');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('banner_promotions', function (Blueprint $table) {
            $table->dropColumn([
                'type', 'code', 'description', 'discount_amount', 
                'discount_type', 'min_transaction', 'quota', 'used_count', 'deleted_at'
            ]);
        });

        Schema::table('notifications', function (Blueprint $table) {
            $table->dropColumn(['is_active', 'deleted_at']);
        });
    }
};
