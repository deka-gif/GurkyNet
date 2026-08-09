# Back-end / Application Server — Laravel 12

**Rujukan SRS:** Bagian 3.1–3.3, 8.1, 10.1.

Stack final (Sprint 0): **Laravel 12 (PHP 8.2+)**, database **MySQL**, auth **Laravel Sanctum**.

| Komponen SRS | Lokasi tipikal |
|---|---|
| API Gateway (logis) | `routes/api.php`, middleware HTTP |
| RBAC Middleware | `app/Http/Middleware/EnsureRole.php` |
| Application Server | `app/Services/`, `app/Actions/`, `app/Http/Controllers/` |
| Modul Integrasi H2H | `app/Services/Integration/` |
| Modul Payment Gateway | config/service Midtrans |
| Modul Notifikasi | service notifikasi |
| Audit Log Service | `app/Listeners/WriteAuditLog.php` + Owner audit |
| Migrations / seeders | `database/migrations/`, `database/seeders/` |

Cache & queue: driver **database** (keputusan Sprint 0 #3, #4). Storage: disk **public** lokal (keputusan #6).
