<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// SRS Bagian 7.8 — Sprint 1 (Skema Basis Data Inti).
// Migration ADDITIVE ke `support_tickets` existing. TIDAK membuat tabel `tickets` baru,
// TIDAK rename support_tickets, TIDAK mengubah kolom status (Terbuka/Pending/Selesai/
// Tertutup) atau category, dan TIDAK menyentuh CustomerSupportRepository/business logic CS
// (scope Sprint 6).
// assigned_to: ON DELETE SET NULL (ENGINEERING DECISION — relasi opsional ke staf CS).
return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasColumn('support_tickets', 'assigned_to')) {
            Schema::table('support_tickets', function (Blueprint $table) {
                $table->foreignId('assigned_to')->nullable()->constrained('users')->onDelete('set null');
            });
        }

        if (!Schema::hasColumn('support_tickets', 'resolved_at')) {
            Schema::table('support_tickets', function (Blueprint $table) {
                $table->timestamp('resolved_at')->nullable();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('support_tickets', 'assigned_to')) {
            Schema::table('support_tickets', function (Blueprint $table) {
                $table->dropForeign(['assigned_to']);
            });
            Schema::table('support_tickets', function (Blueprint $table) {
                $table->dropColumn('assigned_to');
            });
        }

        if (Schema::hasColumn('support_tickets', 'resolved_at')) {
            Schema::table('support_tickets', function (Blueprint $table) {
                $table->dropColumn('resolved_at');
            });
        }
    }
};
