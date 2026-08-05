<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('product_providers', function (Blueprint $table) {
            $table->id();
            $table->string('code', 50)->unique(); // digiflazz, vip
            $table->string('name'); // Digiflazz, VipPulsa, VIP Store, …
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        $digiflazzName = (string) config('ppob.product_providers.digiflazz.name', 'Digiflazz');
        $vipName = (string) config('ppob.product_providers.vip.name', 'VIPAYMENT');
        $vipActive = (bool) config('ppob.product_providers.vip.is_active', false);
        $now = now();

        DB::table('product_providers')->insert([
            [
                'code' => 'digiflazz',
                'name' => $digiflazzName,
                'is_active' => true,
                'sort_order' => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'code' => 'vip',
                'name' => $vipName,
                'is_active' => $vipActive,
                'sort_order' => 2,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);

        Schema::table('products', function (Blueprint $table) {
            $table->foreignId('product_provider_id')
                ->nullable()
                ->after('provider_id')
                ->constrained('product_providers')
                ->nullOnDelete();
            $table->index('product_provider_id');
        });

        $digiflazzId = DB::table('product_providers')->where('code', 'digiflazz')->value('id');
        if ($digiflazzId) {
            DB::table('products')->whereNull('product_provider_id')->update([
                'product_provider_id' => $digiflazzId,
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropConstrainedForeignId('product_provider_id');
        });
        Schema::dropIfExists('product_providers');
    }
};
