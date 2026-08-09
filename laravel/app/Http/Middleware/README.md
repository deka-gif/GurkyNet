# HTTP Middleware

**Rujukan SRS:** Bagian 3.2 (RBAC Middleware), 3.3, 5, 8.1.

| File | Fungsi |
|---|---|
| `EnsureRole.php` | Pemeriksaan hak akses berbasis role sebelum request admin diproses |
| Lainnya | Security headers, error shape, health metrics, tracing |

API Gateway logis = routing di `routes/api.php` + middleware di folder ini (keputusan Sprint 0 #12).
