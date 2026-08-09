# Struktur Monorepo GurkyNet — Pemetaan SRS Bagian 3.2

Keputusan Sprint 0: monorepo resmi; Website + Dashboard Admin satu SPA; API Gateway logis di Laravel.

```text
GurkyNet/
├── .cursorrules                 # Aturan tetap proyek (SRS Bagian 20)
├── apps/
│   ├── mobile/                  # Aplikasi Mobile PPOB (placeholder; stack TBD)
│   └── partner-portal/          # Portal Mitra API (SRS Bagian 30; Sprint 17)
├── src/                         # Website PPOB + Dashboard Admin Multi-Role (React+Vite)
├── laravel/                     # Application Server + API Gateway logis + modul backend
├── deploy/                      # Infrastruktur/deployment (SRS 10.2)
├── docs/                        # Dokumentasi proyek (keputusan Sprint 0, struktur)
├── package.json                 # Frontend (npm)
└── laravel/composer.json        # Backend PHP
```

## Pemetaan komponen SRS 3.2

| Komponen SRS | Lokasi | Catatan |
|---|---|---|
| Website PPOB | `src/pages/public/`, `src/layouts/PublicLayout.tsx` | SRS 3.2 |
| Aplikasi Mobile PPOB | `apps/mobile/` | Placeholder; implementasi ditunda |
| Dashboard Admin Multi-Role | `src/pages/dashboard/` | Satu SPA dengan Website (keputusan #5) |
| API Gateway | `laravel/routes/api.php` + middleware | Logis, bukan Kong (keputusan #12) |
| Application Server | `laravel/app/Services/`, `Actions/`, `Http/Controllers/` | SRS 3.1 lapisan logika bisnis |
| RBAC Middleware | `laravel/app/Http/Middleware/EnsureRole.php` | SRS 3.2, 3.3, 5 |
| Modul Integrasi H2H | `laravel/app/Services/Integration/` | SRS 3.2, 15 |
| Modul Payment Gateway | layanan/config Midtrans di `laravel/` | SRS 3.2, 16 |
| Modul Notifikasi | layanan notifikasi di `laravel/` (+ FCM env) | SRS 3.2, 9.3 |
| Audit Log Service | `laravel/app/Listeners/WriteAuditLog.php`, Owner audit actions | SRS 3.2, 7.10 |
| Portal/Mitra API | `apps/partner-portal/` | SRS 30; belum diimplementasi (Sprint 17) |
