<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('wallet_histories', function (Blueprint $table) {
            $table->index(['wallet_id', 'created_at'], 'wallet_histories_wallet_created_idx');
            $table->index(['wallet_id', 'type', 'created_at'], 'wallet_histories_wallet_type_created_idx');
        });
    }

    public function down(): void
    {
        Schema::table('wallet_histories', function (Blueprint $table) {
            $table->dropIndex('wallet_histories_wallet_created_idx');
            $table->dropIndex('wallet_histories_wallet_type_created_idx');
        });
    }
};
