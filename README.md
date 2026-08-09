# GurkyNet — Sistem PPOB

Monorepo resmi untuk Website/Dashboard Admin (React + Vite) dan API (Laravel 12).

**Sumber kebenaran:** SRS Sistem PPOB GurkyNet v2.2 + aturan di [`.cursorrules`](.cursorrules).

## Stack final (Sprint 0)

| Lapisan | Teknologi |
|---|---|
| Website + Dashboard Admin | React 19, Vite, TypeScript (`src/`) |
| Mobile | Placeholder `apps/mobile/` (stack belum dipilih) |
| API / Application Server | Laravel 12, PHP 8.2+, Sanctum (`laravel/`) |
| Database | MySQL |
| Cache / Queue | Database driver |
| Storage | Disk lokal (`public`) |

Keputusan lengkap: [`docs/SPRINT0_DECISIONS.md`](docs/SPRINT0_DECISIONS.md)  
Peta folder ↔ SRS 3.2: [`docs/STRUCTURE.md`](docs/STRUCTURE.md)

## Menjalankan lokal

### Backend

```bash
cd laravel
cp .env.example .env
composer install
php artisan key:generate
php artisan serve
```

### Frontend

```bash
cp .env.example .env
npm install
npm run dev
```

Set `VITE_API_BASE_URL` di root `.env` ke URL API Laravel (default contoh: `http://127.0.0.1:8000/api/v1`).

## Catatan Sprint 0

Sprint ini hanya menetapkan aturan tetap, struktur folder, dan env fondasi. Tidak menambah tabel, migration, endpoint, UI, auth baru, atau integrasi provider.
