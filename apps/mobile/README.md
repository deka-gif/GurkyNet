# GurkyPay Mobile

Counter-transaction client for GurkyNet. Talks to the **same** Laravel API the web
dashboard uses (`../../laravel`) — no separate backend, no mock data. See
`../../MOBILE_APP_AUDIT_REPORT.md` at the repo root for the full API audit and the
phased build plan this app follows.

## Stack

Expo (React Native) + TypeScript, `expo-router` (file-based navigation), Zustand
(state — same library as the web app), axios (HTTP — same interceptor pattern as
`src/services/api.ts` on web), `expo-secure-store` (Keychain/Keystore-backed token
storage).

## Setup

```bash
cd apps/mobile
npm install
cp .env.example .env   # then edit EXPO_PUBLIC_API_BASE_URL — see comments in the file
npm start
```

Then press `a` for Android, `i` for iOS (macOS only), or `w` for a web preview
(`react-native-web` — useful for quick UI checks, not a target platform).

The Laravel backend must actually be running and reachable from your device/emulator
(see `EXPO_PUBLIC_API_BASE_URL` notes in `.env.example` for the emulator-vs-physical-device
host address gotcha) with `PURCHASE_ENABLED=true` if you want to test past login into a
purchase flow once Fase 3 lands.

## What's implemented (Fase 1 + a slice of Fase 2)

- Navigation shell: `(auth)` stack (Login) + `(tabs)` (Home / Transaksi / Riwayat /
  Notifikasi / Akun), gated on a real secure-storage-persisted session.
- API client (`src/api/client.ts`): bearer-token auth, device/platform headers, the same
  customer-friendly error mapping as web (`parseApiError`), automatic session-clear +
  app-wide "logged out" event on any `401`.
- Auth (`src/store/auth.store.ts`, `src/services/auth.service.ts`): real `POST
  /auth/login` (password), defensive handling of the 2FA response shape (currently dead
  code server-side — see the audit report — but the client won't break if it's re-enabled),
  `GET /auth/me`, `POST /auth/logout`. Registration/OTP/PIN-setup flow is **not** built
  yet (Fase 1 note).
- Wallet (`src/store/wallet.store.ts`): real `GET /wallet` — balance and recent
  transactions on the Home tab are live data, not placeholders.
- Design tokens (`src/theme/`): the exact brand color scale from `src/index.css` on web.
- Reusable UI kit (`src/components/ui/`): Button (large tap targets, loading/disabled
  states baked in), Card, ScreenContainer (pull-to-refresh built in), Loading/Error/Empty
  states, StatusBadge (backend-status-only, no inferred SUCCESS), ComingSoon (honest
  placeholder for not-yet-built screens — never fake data).

## What's intentionally NOT built yet

Transaksi (catalog/checkout/PIN), Riwayat (transaction history/detail/receipt),
Notifikasi (list — polling, since no real-time push exists server-side yet), Top Up,
Transfer, KYC screens, Referral/Loyalty screens, registration. Each shows an honest
"Fitur ini akan hadir pada Fase X" placeholder rather than a mock. See the phase
breakdown in the audit report for what's next.
