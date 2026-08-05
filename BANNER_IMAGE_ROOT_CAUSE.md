# BANNER IMAGE ROOT CAUSE

## 1. Root cause

Banner/media **upload and DB relations were fine**. The broken gray placeholder was caused by **URL delivery**, not missing `media_id`.

Live proof (`https://gurkynet.my.id`):

| URL | Result |
|---|---|
| `/api/v1/public/banners` | JSON OK — banner + `imageMediaId` present |
| Generated image | `https://gurkynet.my.id/storage/general/{uuid}.png` |
| Opening that URL | **200 `text/html`** — React SPA `index.html` (1327 bytes), **not** the PNG |

The SPA vhost catch-all serves `index.html` for `/storage/*`. `<img>` therefore loads HTML → blank/gray image.

`MediaUrl` previously built classic `/storage/{path}` URLs from the request host. That path never reaches Laravel’s public disk on this deployment.

Upload was never the problem. Nginx/php.ini were not changed (per request).

---

## 2. Files modified

### Backend
- `laravel/app/Support/MediaUrl.php` — emit `/api/v1/public/media/{path}` (CDN still wins when set)
- `laravel/app/Http/Controllers/Api/v1/Public/PublicMediaController.php` — **new** streamer from public disk
- `laravel/routes/api.php` — `GET /api/v1/public/media/{path}`
- `laravel/config/filesystems.php` — `media_delivery_path` / `MEDIA_DELIVERY_PATH`
- `laravel/app/Http/Resources/BannerResource.php` — `image`, `imageUrl`, `image_url`, `thumbnail_url` (absolute)
- `laravel/app/Http/Resources/PromotionResource.php` — same absolute string fields
- `laravel/app/Http/Resources/VoucherResource.php` — same absolute string fields
- `laravel/app/Http/Resources/MediaResource.php` — `image_url`, `thumbnail_url`
- `laravel/tests/Unit/MediaUrlTest.php`
- `laravel/tests/Feature/PublicMediaServeTest.php`
- `laravel/.env.example` — `MEDIA_DELIVERY_PATH`

### Frontend
- `src/utils/mediaUrl.ts` — rewrite legacy `/storage/` → API media route; `resolveMediaSrc`
- Marketing Banner / Promotion / Voucher / Website Settings
- Dashboard homepage carousel, AppPreview, Footer, AuthLayout

**Not touched:** upload controller logic, nginx, php.ini.

---

## 3. Validation

- Unit: `MediaUrlTest` — relative / legacy `/storage` / CDN
- Feature: `PublicMediaServeTest` — stream route + banner fields
- Live contract after deploy:  
  `GET /api/v1/public/banners` → `image_url` / `thumbnail_url` contain  
  `https://gurkynet.my.id/api/v1/public/media/general/...`  
  Opening that URL must return image bytes (not HTML).
- After deploy on Azure: run `php artisan route:clear` (or rebuild `route:cache`) so `GET /api/v1/public/media/{path}` is registered.

---

## 4. Final confirmation

After deploy of API + SPA:

1. Public banners API returns absolute API media URLs (`image_url` + `thumbnail_url`).
2. Opening those URLs displays the PNG/JPG/WEBP.
3. Marketing Banner preview shows the image.
4. User Homepage carousel shows the image.
5. Media Library, Promotion, Voucher, Logo, Homepage sections use the same MediaUrl pipeline.

Architecture remains CDN/S3 ready: set `CDN_URL` to bypass the API streamer.
