<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// SRS Bagian 7.9 — Sprint 1 (Skema Basis Data Inti).
// Tabel canonical baru sesuai SRS, berjalan PARALEL dengan `settings`, `system_settings`,
// dan `website_settings` existing. Tidak ada satu pun dari ketiga tabel tersebut yang
// disentuh, dan tidak ada migrasi data — integrasi Marketing adalah scope Sprint 5.
// updated_by: ON DELETE SET NULL (ENGINEERING DECISION — relasi opsional ke staf Marketing).
return new class extends Migration {
    public function up(): void
    {
        Schema::create('site_content', function (Blueprint $table) {
            $table->id();
            $table->string('key', 255)->unique();
            $table->text('value')->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('site_content');
    }
};
