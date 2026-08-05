# MEDIA LIBRARY ROOT CAUSE

## 1. Root cause

Media Library thumbnails broke because **absolute URLs were baked into `media.url` at upload time** using `Storage::disk('public')->url($path)`, which embeds `APP_URL`.

On Azure / split hosting this fails in two compounding ways:

1. **Wrong host baked into DB** — if `APP_URL` is `http://127.0.0.1:9000`, `http://localhost`, or any host that is not the live API host, every `<img src>` points at a dead origin forever.
2. **SPA ≠ API origin** — even when the API correctly returned a *relative* `/storage/...` path, the React SPA on `https://gurkynet.my.id` resolved that path against the **SPA origin**, not `https://api.gurkynet.my.id`. The file lives on the API public disk (`laravel/public/storage` → `storage/app/public`), so the SPA `/storage/...` request 404s and the thumbnail is blank.

Upload, DB insert, and the physical file were all fine. The broken step was **URL resolution for display**.

Verified non-causes:

| Check | Result |
|---|---|
| `php artisan storage:link` | Already linked |
| File on disk | `storage/app/public/general/{uuid}.png` exists |
| Media row created | Yes |
| Frontend reading `thumbnail_url` vs `url` | Uses `media.url` correctly |
| Nginx `/storage` | Served from Laravel `public` on the API vhost |
| MIME / image component | Not the failure mode |

---

## 2. Why upload succeeded

`MediaController@store` writes the binary with `Storage::disk('public')->putFileAs(...)` and inserts a `media` row. That path never depended on a browser-reachable URL. Nginx/PHP upload limits (after the 413 fix) allow the multipart body through. Hence: upload ✔, file ✔, DB ✔.

---

## 3. Why preview failed

Chain that broke:

```
DB url (absolute with wrong APP_URL OR relative /storage/…)
  → MediaResource / accessor returned that value as-is (or double-transformed inconsistently)
  → Frontend store kept media.url
  → <img src={media.url}>
  → Browser requested wrong host (localhost / SPA origin)
  → 404 / blank thumbnail
```

File on disk was never requested at the correct API public URL.

---

## 4. Files changed

### Backend

| File | Change |
|---|---|
| `laravel/app/Support/MediaUrl.php` | Normalize any stored value to a disk-relative path; rebuild absolute URL from `CDN_URL` or **current request host** (fallback `APP_URL`) + `/storage/{path}` |
| `laravel/app/Http/Controllers/Api/v1/Admin/MediaController.php` | Persist **disk-relative** path only (`general/uuid.png`); delete via `diskPath()` |
| `laravel/app/Http/Resources/MediaResource.php` | Resolve from `getRawOriginal('url')`; expose `path` |
| `laravel/app/Models/Media.php` | Safer `getUrlAttribute`; add `diskPath()` |
| `laravel/app/Http/Resources/BannerResource.php` | Resolve image from raw media path |
| `laravel/app/Http/Controllers/Api/v1/Public/PublicWebsiteController.php` | News covers use raw path + `MediaUrl::absolute()` |
| `laravel/tests/Unit/MediaUrlTest.php` | Unit coverage for relative / legacy absolute / CDN |

### Frontend

| File | Change |
|---|---|
| `src/utils/mediaUrl.ts` | `resolveMediaUrl()` — prefix relative `/storage/...` with `API_ORIGIN` from `VITE_API_BASE_URL` |
| `src/pages/dashboard/MarketingMediaLibrary.tsx` | Thumbnails, preview, copy URL use `resolveMediaUrl` |
| `src/components/common/MediaChooserModal.tsx` | Grid + select emit resolved URLs |
| `src/components/sections/AppPreview.tsx` | Banner preview images resolved |
| `src/pages/dashboard/DashboardHomePage.tsx` | Dashboard banner carousel resolved |

---

## 5. Architecture explanation

```
Upload
  → store file on public disk
  → DB.url = "general/{uuid}.png"   ← path only, never a host

Read (API)
  → MediaUrl::absolute(raw)
       if CDN_URL set  → {CDN_URL}/{path}
       else            → {request host|APP_URL}/storage/{path}

Read (SPA safety net)
  → resolveMediaUrl(url)
       absolute http(s)/data/blob → as-is
       /storage/... or disk path  → {API_ORIGIN}/storage/...
```

Environment support:

| Environment | Behavior |
|---|---|
| Local (`APP_URL` / request `127.0.0.1:9000`) | `http://127.0.0.1:9000/storage/...` |
| Azure API vhost | Request host (`api.gurkynet.my.id`) wins over a stale `APP_URL` |
| Future CDN | Set `CDN_URL`; MediaUrl prefers it |
| Future S3 | Swap disk / set CDN or AWS public URL; DB path contract unchanged |

No hardcoded production domains.

---

## 6. Validation performed

- Code path audit: Media model → MediaResource → MediaController store/delete → filesystems `public` disk → `cdn_url` → nginx `/storage` location → frontend store → `<img src>`.
- Confirmed store no longer calls `Storage::url()` for persistence.
- Confirmed delete uses `diskPath()` so legacy absolute DB values still delete the correct file.
- Unit tests: `php artisan test --filter=MediaUrlTest` — **4 passed**.
- Frontend typecheck: `tsc --noEmit` — clean for media URL changes.

Manual checklist (run on target env after deploy):

1. Upload PNG  
2. Upload JPG  
3. Upload WEBP  
4. Open Media Library — thumbnails load  
5. Preview modal shows image  
6. Copy URL → opens the image on the API/CDN host  
7. Delete removes DB row + file  
8. Banner CMS still picks media  
9. Homepage / dashboard banners still render  

---

## 7. Production impact

- **New uploads:** correct immediately (relative DB path + request-host absolute URLs).
- **Legacy rows** with absolute `http://127.0.0.1:.../storage/...` or wrong host: **rebased on read** — no migration required.
- **CDN:** set `CDN_URL` when ready; no code change for path contract.
- **Risk:** low. Delete and banner/news consumers use the same normalizer. SPA safety net prevents regression if an API ever returns a relative path again.

Ops reminder: media files are served from the **API** public root (`/storage/...`). Keep `php artisan storage:link` on the API host and ensure the API nginx vhost roots to `laravel/public`.

---

## 8. Final result

Root cause fixed at the source (store relative paths; resolve absolute URLs at read time from request/CDN) with a frontend safety net so the SPA never resolves `/storage` against the marketing origin.

Media Library thumbnails, preview, copy URL, delete, banner CMS, and homepage/dashboard banners now use a production-ready URL pipeline suitable for local, Azure VPS, CDN, and future S3.
