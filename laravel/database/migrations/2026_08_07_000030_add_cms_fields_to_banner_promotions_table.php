<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('banner_promotions', function (Blueprint $table) {
            $table->string('slug', 191)->nullable()->after('title');
            $table->text('terms')->nullable()->after('description');
            $table->timestamp('starts_at')->nullable()->after('redirect_url');
            $table->timestamp('ends_at')->nullable()->after('starts_at');
            $table->string('cta_label', 120)->nullable()->after('ends_at');
            $table->unsignedInteger('priority')->default(0)->after('cta_label');
            $table->unsignedInteger('sort_order')->default(0)->after('priority');
        });

        // Backfill unique slugs for existing rows
        $rows = DB::table('banner_promotions')->select('id', 'title', 'slug')->orderBy('id')->get();
        $used = [];

        foreach ($rows as $row) {
            $base = Str::slug((string) ($row->title ?: 'promo-'.$row->id)) ?: 'promo-'.$row->id;
            $slug = $base;
            $i = 2;
            while (isset($used[$slug])) {
                $slug = $base.'-'.$i;
                $i++;
            }
            $used[$slug] = true;
            DB::table('banner_promotions')->where('id', $row->id)->update(['slug' => $slug]);
        }

        Schema::table('banner_promotions', function (Blueprint $table) {
            $table->unique('slug');
            $table->index(['type', 'is_active', 'sort_order']);
            $table->index(['starts_at', 'ends_at']);
        });
    }

    public function down(): void
    {
        Schema::table('banner_promotions', function (Blueprint $table) {
            $table->dropUnique(['slug']);
            $table->dropIndex(['type', 'is_active', 'sort_order']);
            $table->dropIndex(['starts_at', 'ends_at']);
            $table->dropColumn([
                'slug',
                'terms',
                'starts_at',
                'ends_at',
                'cta_label',
                'priority',
                'sort_order',
            ]);
        });
    }
};
