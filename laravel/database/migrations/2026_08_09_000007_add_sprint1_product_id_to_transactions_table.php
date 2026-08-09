<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// SRS Bagian 7.5 — Sprint 1 (Skema Basis Data Inti).
// Migration ADDITIVE: hanya menambah product_id (nullable). Tidak menyentuh status,
// App\Enums\TransactionStatus, target_number, provider_ref, amount, atau payment flow apa pun.
// product_id: ON DELETE SET NULL (ENGINEERING DECISION — transaksi adalah data historis/
// finansial, tidak boleh cascade-delete saat produk induk dihapus; kolom nullable sehingga
// referensi cukup dikosongkan).
return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasColumn('transactions', 'product_id')) {
            Schema::table('transactions', function (Blueprint $table) {
                $table->foreignId('product_id')->nullable()->constrained('products')->onDelete('set null');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('transactions', 'product_id')) {
            Schema::table('transactions', function (Blueprint $table) {
                $table->dropForeign(['product_id']);
            });
            Schema::table('transactions', function (Blueprint $table) {
                $table->dropColumn('product_id');
            });
        }
    }
};
