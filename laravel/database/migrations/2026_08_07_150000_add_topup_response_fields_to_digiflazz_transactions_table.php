<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('digiflazz_transactions', function (Blueprint $table) {
            $table->string('rc', 16)->nullable()->after('digiflazz_status');
            $table->unsignedInteger('price')->nullable()->after('rc');
            $table->decimal('buyer_last_saldo', 18, 2)->nullable()->after('price');
            $table->string('tele')->nullable()->after('buyer_last_saldo');
            $table->string('wa')->nullable()->after('tele');
        });
    }

    public function down(): void
    {
        Schema::table('digiflazz_transactions', function (Blueprint $table) {
            $table->dropColumn(['rc', 'price', 'buyer_last_saldo', 'tele', 'wa']);
        });
    }
};
