# SPRINT 5 — EXECUTION REPORT

**Project:** GurkyNet PPOB  
**Sprint:** 5 — Marketing (Konten, Banner, Branding)  
**Source of truth:** SRS GurkyNet v2.2 CLEAN (FR-MKT01, FR-MKT04, FR-MKT06) + `.cursorrules` + Final Sprint 5 Audit  
**Date:** 2026-08-27  
**Verdict:** **SPRINT 5 READY FOR VERIFICATION**

---

## 1. Scope terkunci

### Implemented (Wajib MVP)
| ID | Status |
|----|--------|
| FR-MKT01 Identitas perusahaan (+ jam operasional) | DONE |
| FR-MKT04 Logo utama / favicon / dark + PNG/SVG | DONE |
| FR-MKT06 Banner beranda CRUD + order + schedule | DONE |

### Out of scope (tidak dikerjakan)
FR-MKT02, FR-MKT03, FR-MKT05, FR-MKT07, **FR-MKT08**, FR-MKT09, FR-MKT10, FR-MKT11, FR-DIFF, Sprint 6+, Finance/Wallet rewrite, WebSocket, redesign besar.

Field CTA/`redirect_url` banner **tetap** (existing) tetapi **tidak** dikembangkan sebagai scope FR-MKT08.

---

## 2. Blocker fixed (FR-MKT06)

`MarketingBannerAction.php` mengalami `ParseError` (class tidak tertutup `}`).

- Ditutup class dengan benar (tanpa refactor besar).
- Regression lama kini **PASS**:
  - `MarketingTest::banner_crud_operations`
  - `PublicBannerCmsTest::marketing_can_persist_full_cms_banner_fields`

---

## 3. Architecture decision — dual schema (Bagian 7.9)

SRS mendokumentasikan tabel `banners` & `site_content`.

**Runtime aktual (dipertahankan):**
- `banner_promotions` — banner carousel + schedule (`starts_at` / `ends_at` / `is_active` / `sort_order`)
- `website_settings` — identitas perusahaan + logo/favicon/dark

**Keputusan:** Tidak migrasi besar ke `banners` / `site_content` di Sprint 5.

Alasan: struktur existing secara fungsional memenuhi FR-MKT01/04/06 (identity fields, media IDs, public carousel filter + order). Migrasi rename hanya menambah risiko data/history tanpa gain compliance.

Perubahan schema Sprint 5 bersifat **additive + reversible**:
- `2026_08_27_200001_add_operating_hours_to_website_settings_table.php`

---

## 4. Implementation summary

### FR-MKT01 — Identitas perusahaan
- Reuse `WebsiteSetting` (tidak ada settings system kedua).
- Field baru: `operating_hours` (nullable string max 255).
- Validation: Create/Update requests.
- Resource + public settings + Account Help (`operatingHours`).
- Marketing UI: field Jam Operasional di Website Settings.
- Public surfaces: Footer + Contact section menampilkan jam operasional CMS.
- Audit: `MARKETING_UPDATE_COMPANY_SETTINGS` via `MarketingService` (create/update settings).
- RBAC: mutation hanya `marketing` (+ owner read-only middleware existing). Finance/Ops/CS/User → 403.

### FR-MKT04 — Logo / branding
- Reuse media library + `logo` / `logo_dark` / `favicon` (+ media IDs).
- `MediaController` menerima SVG valid (`image/svg+xml` / XML) + PNG/JPEG/WebP/ICO.
- Extension allowlist + content check SVG (tolak `<script` / event handlers / spoof).
- Max size tetap **5120 KB**.
- Media chooser `accept` diperbarui untuk SVG.

### FR-MKT06 — Banner beranda
- CRUD admin Marketing (create/list/update/delete) setelah ParseError fix.
- Public `GET /api/v1/public/banners` memakai `visibleInCarousel()` + `orderedForDisplay()`.
- Soft-delete → tidak tampil public.
- Schedule: upcoming/expired/inactive excluded.
- Audit existing: `MARKETING_CREATE_BANNER` / `UPDATE_BANNER` / `DELETE_BANNER`.

### Media delivery
- Tetap lewat public media URL / disk `public` existing (tidak ubah infrastruktur unrelated).

---

## 5. Tests

### Baru
`tests/Feature/Sprint5MarketingTest.php` — **7/7 PASS**
- FR-MKT01 save + public/help + validation + unauthorized mutation
- FR-MKT04 PNG/SVG accept; invalid/oversized/script SVG reject; logo variants assign
- FR-MKT06 CRUD + order + schedule + public filter + audit + RBAC

### Regression lama (sebelumnya gagal)
| Test | Hasil |
|------|-------|
| `MarketingTest::banner_crud_operations` | PASS |
| `PublicBannerCmsTest::marketing_can_persist_full_cms_banner_fields` | PASS |

### Full suite
```
Tests: 1 failed, 612 passed (4432 assertions)
```

**1 fail pre-existing (bukan Sprint 5):**
- `FinanceTest::finance_user_can_list_settlements` — assert key `pagination` (sama seperti baseline Sprint 3/4).

Baseline sebelumnya ~603 pass / **3** fail → sekarang **612** pass / **1** fail (2 Marketing fail tertutup + 7 Sprint5).

### Frontend lint
`npm run lint` exit **2** — error TS pre-existing (EscalationQueues interval types, Finance store, RealtimeManager, HomepageSections animation, dll.). Tidak diperkenalkan oleh perubahan Sprint 5 identity/banner scope.

---

## 6. Files touched (ringkas)

**Backend**
- `MarketingBannerAction.php` (syntax fix)
- Migration `operating_hours`
- `WebsiteSetting` model/request/resource/repo + public/account controllers
- `MediaController` SVG validation

**Frontend**
- `MarketingWebsiteSettings.tsx`, `website.service.ts`, `types/website.ts`
- `Footer.tsx`, `Contact.tsx`, `MediaChooserModal.tsx`

**Tests / docs**
- `Sprint5MarketingTest.php`
- `SPRINT5_EXECUTION_REPORT.md` (this file)

---

## 7. Findings / notes

1. CTA/link banner fields remain for backward compatibility; **FR-MKT08 not implemented**.
2. Owner tetap read-only pada mutation Marketing via `EnsureOwnerReadOnly` (Sprint 2).
3. Operations dapat akses homepage-builder routes lain, **bukan** website settings / banner mutation Marketing.
4. Tidak ada parallel media/settings/audit system.

---

## 8. Ready for user verification

Silakan audit/konfirmasi Sprint 5 sebelum Sprint 6.
