<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Customer financial statement — efficient opening/period scans on wallet_mutations.
 * Index only; no semantic change to ledger.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('wallet_mutations', function (Blueprint $table) {
            $table->index(['wallet_id', 'created_at'], 'wallet_mutations_wallet_created_idx');
        });
    }

    public function down(): void
    {
        Schema::table('wallet_mutations', function (Blueprint $table) {
            $table->dropIndex('wallet_mutations_wallet_created_idx');
        });
    }
};
