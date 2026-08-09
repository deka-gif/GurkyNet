# Front-end Web — Website PPOB + Dashboard Admin

**Rujukan SRS:** Bagian 3.1–3.2, 4.1–4.6, 13.

Stack final (Sprint 0): **React 19 + Vite + TypeScript** (CSR SPA).

| Area | Path | Fungsi |
|---|---|---|
| Website publik | `pages/public/`, `layouts/PublicLayout.tsx` | Pendaftaran, login, konten publik |
| Dashboard Admin | `pages/dashboard/` | Multi-role: Marketing, Operasional, Finance, CS, Owner |
| User/Agen (web) | `pages/dashboard/` (modul user) | Transaksi & akun di web |
| State / API client | `store/`, `services/` | Mengonsumsi API Laravel yang sama |

Website dan Dashboard Admin **satu codebase/build** (keputusan Sprint 0 #5).
