# Sprint 0 — Keputusan Final (dikonfirmasi user)

Rujukan: SRS Bagian 2.4, 3, 10.1, 10.2, 20 + Panduan Prompt Cursor Sprint 0.

| # | Topik | Keputusan |
|---|---|---|
| 1 | Front-end Website | React 19 + Vite SPA (CSR) — baseline |
| 2 | Front-end Mobile | Ditunda; scaffold placeholder saja (stack belum dipilih) |
| 3 | Cache | `CACHE_STORE=database` — baseline |
| 4 | Queue | `QUEUE_CONNECTION=database` — baseline |
| 5 | Dashboard Admin | Satu SPA bersama Website (`src/`) |
| 6 | Object Storage | Disk lokal (`FILESYSTEM_DISK=public`) — baseline |
| 7 | Staging / monitoring / CI-CD | Belum — backlog, tidak di-setup di Sprint 0 |
| 8 | SESSION_LIFETIME | 120 menit |
| 9 | Auth token | Laravel Sanctum sebagai "JWT atau setara" (SRS 8.1) — final |
| 10 | Package manager frontend | npm resmi (`package-lock.json`); `bun.lock` dihapus |
| 11 | Layout repo | Monorepo resmi |
| 12 | API Gateway | Lapisan logis di Laravel (routes + middleware), bukan gateway fisik |
| 13 | Folder `database/` di root | Seeder dipindahkan ke `laravel/database/seeders/DemoUserSeeder.php`. Folder root `database/` TIDAK dihapus (approval penghapusan ditolak/di-skip) — dipertahankan hanya sebagai marker deprecated/legacy (lihat `database/README.md`) |
| 14 | File legacy | Sebagian: ganti README AI Studio; hapus script patch/verify; pertahankan report & blueprint |
| 15 | `.cursorrules` | Salin persis Lampiran A Panduan Prompt Cursor |

## Tech stack final (Sprint 0)

| Komponen | Teknologi |
|---|---|
| Website + Dashboard Admin | React 19 + Vite + TypeScript (`src/`) |
| Mobile | Placeholder `apps/mobile/` (stack TBD) |
| Back-end / API | Laravel 12 (PHP 8.2+) di `laravel/` |
| Database | MySQL |
| Cache | Database driver (Redis config tersedia, belum wajib dipakai) |
| Queue | Database driver |
| Object Storage | Local public disk |
| Auth | Laravel Sanctum |
| Infra | Azure VPS (lihat `deploy/`) — staging/CI/monitoring = backlog |
