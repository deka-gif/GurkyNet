#!/usr/bin/env bash
# GurkyNet — Fix HTTP 413 / PHP upload limits on Azure Ubuntu VPS
# Run ON THE PRODUCTION SERVER as root (or with sudo):
#   sudo bash deploy/fix-upload-limits.sh
#
# Does NOT modify Laravel application code.
set -euo pipefail

PHP_VER="${PHP_VER:-8.4}"
DOMAIN="${DOMAIN:-gurkynet.my.id}"
APP_DIR="${APP_DIR:-/var/www/gurkynet}"
TARGET_UPLOAD="20M"
TARGET_POST="25M"
TARGET_BODY="20M"

echo "=============================================="
echo " GurkyNet upload-limit repair"
echo " PHP=${PHP_VER}  domain=${DOMAIN}"
echo "=============================================="

# ---------------------------------------------------------------------------
# 1) Discover active PHP-FPM configuration
# ---------------------------------------------------------------------------
echo ""
echo "==> [1] Active PHP-FPM / loaded ini"
systemctl is-active "php${PHP_VER}-fpm" || true
PHP_FPM_BIN="/usr/sbin/php-fpm${PHP_VER}"
if [[ -x "$PHP_FPM_BIN" ]]; then
  "$PHP_FPM_BIN" -i 2>/dev/null | grep -E "^(Loaded Configuration File|Scan this dir|upload_max_filesize|post_max_size|max_execution_time|max_input_time)" || true
  echo "--- php-fpm -tt ---"
  "$PHP_FPM_BIN" -tt 2>&1 | tail -n 20 || true
else
  echo "WARN: $PHP_FPM_BIN not found"
fi

echo "--- CLI php -i (may differ from FPM) ---"
php -i 2>/dev/null | grep -E "^(Loaded Configuration File|Scan this dir for additional .ini files|upload_max_filesize|post_max_size)" || true

echo "--- All upload_max_filesize / post_max_size in /etc/php/${PHP_VER} ---"
grep -RInE '^\s*(upload_max_filesize|post_max_size|max_execution_time|max_input_time)\s*=' "/etc/php/${PHP_VER}/" 2>/dev/null || true

# ---------------------------------------------------------------------------
# 2–3) Discover nginx vhosts + includes
# ---------------------------------------------------------------------------
echo ""
echo "==> [2-3] Nginx virtual hosts and includes"
nginx -T 2>/dev/null | grep -E 'configuration file|include |server_name |client_max_body_size|listen ' || true

echo "--- sites-enabled ---"
ls -la /etc/nginx/sites-enabled/ 2>/dev/null || true

echo "--- All client_max_body_size on disk ---"
grep -RIn 'client_max_body_size' /etc/nginx/ 2>/dev/null || true

# ---------------------------------------------------------------------------
# 4–9) Explain + apply fixes
# ---------------------------------------------------------------------------
echo ""
echo "==> [9] Why HTTP 413 happens"
echo "HTTP 413 is returned by Nginx when request body > client_max_body_size."
echo "PHP upload_max_filesize does NOT produce 413; it yields empty upload / Laravel validation."
echo "UAT 413 => Nginx limit is too low (often default 1m) OR a vhost override."
echo "Also fix PHP so 5MB files are accepted after Nginx allows the body."

# Backup
TS="$(date +%Y%m%d%H%M%S)"
BACKUP_DIR="/root/gurkynet-upload-fix-backup-${TS}"
mkdir -p "$BACKUP_DIR"
echo ""
echo "==> Backups → ${BACKUP_DIR}"

# PHP FPM drop-in (highest priority number wins among conf.d)
PHP_FPM_INI="/etc/php/${PHP_VER}/fpm/conf.d/99-gurkynet-uploads.ini"
if [[ -f "/etc/php/${PHP_VER}/fpm/php.ini" ]]; then
  cp -a "/etc/php/${PHP_VER}/fpm/php.ini" "${BACKUP_DIR}/php.ini.bak"
fi
if [[ -f "$PHP_FPM_INI" ]]; then
  cp -a "$PHP_FPM_INI" "${BACKUP_DIR}/99-gurkynet-uploads.ini.bak"
fi

echo "==> [11] Writing ${PHP_FPM_INI}"
cat > "$PHP_FPM_INI" <<EOF
; GurkyNet — managed by deploy/fix-upload-limits.sh
; Do not lower below Media Library requirements
upload_max_filesize = ${TARGET_UPLOAD}
post_max_size = ${TARGET_POST}
max_execution_time = 300
max_input_time = 300
memory_limit = 256M
EOF
chmod 644 "$PHP_FPM_INI"

# Also sync CLI for artisan/php -i consistency (optional but recommended)
PHP_CLI_INI="/etc/php/${PHP_VER}/cli/conf.d/99-gurkynet-uploads.ini"
cp -a "$PHP_FPM_INI" "$PHP_CLI_INI"

# Nginx: patch every sites-enabled server that serves this domain, or http{} default
echo "==> Patching Nginx client_max_body_size → ${TARGET_BODY}"

# Prefer patching active site files that mention the domain
mapfile -t SITE_FILES < <(grep -Rl "server_name.*${DOMAIN}" /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null || true)
if [[ ${#SITE_FILES[@]} -eq 0 ]]; then
  mapfile -t SITE_FILES < <(ls /etc/nginx/sites-enabled/* 2>/dev/null || true)
fi

for f in "${SITE_FILES[@]}"; do
  [[ -f "$f" ]] || continue
  cp -a "$f" "${BACKUP_DIR}/$(basename "$f").bak"
  if grep -qE '^\s*client_max_body_size\s+' "$f"; then
    sed -i -E "s/^\s*client_max_body_size\s+[^;]+;/    client_max_body_size ${TARGET_BODY};/g" "$f"
    echo "  updated existing client_max_body_size in $f"
  else
    # Insert after first server_name line inside file
    if grep -q 'server_name' "$f"; then
      sed -i "0,/server_name .*/s//&\n    client_max_body_size ${TARGET_BODY};/" "$f"
      echo "  inserted client_max_body_size in $f"
    else
      echo "  SKIP (no server_name): $f"
    fi
  fi
done

# Also set http-level safety net if missing
NGINX_CONF="/etc/nginx/nginx.conf"
if [[ -f "$NGINX_CONF" ]]; then
  cp -a "$NGINX_CONF" "${BACKUP_DIR}/nginx.conf.bak"
  if grep -qE '^\s*client_max_body_size\s+' "$NGINX_CONF"; then
    sed -i -E "s/^\s*client_max_body_size\s+[^;]+;/    client_max_body_size ${TARGET_BODY};/" "$NGINX_CONF"
    echo "  updated http-level client_max_body_size in nginx.conf"
  else
    # Insert inside http { block after opening brace
    sed -i "/^http\s*{/a\\    client_max_body_size ${TARGET_BODY};" "$NGINX_CONF"
    echo "  inserted http-level client_max_body_size in nginx.conf"
  fi
fi

# ---------------------------------------------------------------------------
# Validate + restart only what is needed
# ---------------------------------------------------------------------------
echo ""
echo "==> Validate Nginx"
nginx -t

echo "==> Validate PHP-FPM config"
"$PHP_FPM_BIN" -tt

echo "==> Reload services"
systemctl reload "php${PHP_VER}-fpm"
systemctl reload nginx

echo ""
echo "==> Validation — FPM effective values"
# Query via a one-shot php-fpm pool is hard; use loaded conf.d + php-cgi if available.
# Best check: php-fpm -i when supported, else grep conf.d
grep -E 'upload_max_filesize|post_max_size|max_execution_time|max_input_time' "$PHP_FPM_INI"
php -r "echo 'CLI upload_max_filesize=' . ini_get('upload_max_filesize') . PHP_EOL; echo 'CLI post_max_size=' . ini_get('post_max_size') . PHP_EOL;"

echo "--- nginx -T | client_max_body_size ---"
nginx -T 2>/dev/null | grep -n 'client_max_body_size' || true

echo ""
echo "==> Optional curl body-size probe (expect NOT 413 for ~3MB)"
TMP="$(mktemp)"
dd if=/dev/urandom of="$TMP" bs=1M count=3 status=none
HTTP_CODE="$(curl -sS -o /dev/null -w '%{http_code}' \
  -X POST "https://${DOMAIN}/api/v1/admin/media" \
  -H 'Accept: application/json' \
  -F "file=@${TMP};type=application/octet-stream" \
  || true)"
rm -f "$TMP"
echo "POST /api/v1/admin/media without auth → HTTP ${HTTP_CODE}"
echo "(401/403/422 = body accepted by Nginx; 413 = still blocked)"

echo ""
echo "=============================================="
echo " DONE"
echo " Backup: ${BACKUP_DIR}"
echo " PHP FPM ini: ${PHP_FPM_INI}"
echo " Expected: upload ${TARGET_UPLOAD}, post ${TARGET_POST}, body ${TARGET_BODY}"
echo " Re-test Media Library upload (≤5MB image) in UAT."
echo "=============================================="
