<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// SRS Bagian 7.9 — Sprint 1 (Skema Basis Data Inti).
// Tabel canonical baru sesuai SRS, berjalan PARALEL dengan `banner_promotions` existing.
// `banner_promotions` TIDAK disentuh dan TIDAK ada migrasi data — integrasi Marketing
// adalah scope Sprint 5.
// active_from/active_until dibuat nullable (ENGINEERING DECISION — lifecycle banner yang
// langsung aktif tanpa jadwal akhir/awal tertentu tidak wajib mengisi kedua field ini).
return new class extends Migration {
    public function up(): void
    {
        Schema::create('banners', function (Blueprint $table) {
            $table->id();
            $table->string('image_url', 255);
            $table->string('link_target', 255)->nullable();
            $table->timestamp('active_from')->nullable();
            $table->timestamp('active_until')->nullable();
            $table->unsignedInteger('sort_order');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('banners');
    }
};
