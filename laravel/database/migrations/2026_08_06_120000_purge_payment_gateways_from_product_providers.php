<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Ensure product_providers contains ONLY PPOB catalog sources.
 * Remove any payment-gateway rows that were incorrectly inserted.
 * Guarantee Digiflazz + VIP brand rows exist.
 */
return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('product_providers')) {
            return;
        }

        $paymentCodes = array_keys((array) config('ppob.payment_gateways', []));
        if ($paymentCodes === []) {
            $paymentCodes = ['midtrans', 'xendit', 'alterra', 'artajasa'];
        }

        DB::table('product_providers')->whereIn('code', $paymentCodes)->delete();

        $now = now();
        $hasPriority = Schema::hasColumn('product_providers', 'priority');

        $vipName = $this->settingValue('ppob_vip_display_name')
            ?: (string) config('ppob.product_providers.vip.name', 'VIPAYMENT');
        $vipName = trim($vipName) !== '' ? trim($vipName) : 'VIPAYMENT';
        $vipActive = filter_var(
            $this->settingValue('ppob_vip_enable')
                ?? config('ppob.product_providers.vip.is_active', false),
            FILTER_VALIDATE_BOOLEAN
        );
        $digiName = (string) config('ppob.product_providers.digiflazz.name', 'Digiflazz');

        $digi = [
            'name' => $digiName,
            'is_active' => true,
            'sort_order' => 1,
            'updated_at' => $now,
            'created_at' => $now,
        ];
        if ($hasPriority) {
            $digi['priority'] = 1;
        }
        DB::table('product_providers')->updateOrInsert(['code' => 'digiflazz'], $digi);

        $vip = [
            'name' => $vipName,
            'is_active' => $vipActive,
            'sort_order' => 2,
            'updated_at' => $now,
            'created_at' => $now,
        ];
        if ($hasPriority) {
            $vip['priority'] = 2;
        }
        DB::table('product_providers')->updateOrInsert(['code' => 'vip'], $vip);

        $digiflazzId = DB::table('product_providers')->where('code', 'digiflazz')->value('id');
        if ($digiflazzId && Schema::hasColumn('products', 'product_provider_id')) {
            DB::table('products')->whereNull('product_provider_id')->update([
                'product_provider_id' => $digiflazzId,
            ]);
        }
    }

    public function down(): void
    {
        // Non-destructive.
    }

    protected function settingValue(string $key): ?string
    {
        foreach (['system_settings', 'settings'] as $table) {
            if (!Schema::hasTable($table)) {
                continue;
            }
            $value = DB::table($table)->where('key', $key)->value('value');
            if (is_string($value) && $value !== '') {
                return $value;
            }
        }

        return null;
    }
};
