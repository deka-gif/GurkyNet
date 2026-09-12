# Technical Debt Backlog

Non-urgent items. Do not block APK / release gates unless Owner re-prioritizes.

## TD-2026-09-12 — Stale PHPUnit expectations (full suite)

**Logged:** 2026-09-12 (final APK verification)  
**Priority:** backlog (not urgent)  
**Proven:** identical failure set on pre-session baseline `c6fa46ef` vs HEAD `d29a1127` when run with `memory_limit=1024M`  
(`46 failed, 1 skipped` on both; HEAD has more *passed* from new tests). Earlier OOM at 128MB hid most of these.

Owner approved skipping this set for the 2026-09-12 preview APK batch (not caused by that day's feature work).

### TD-2026-09-12-A — Finance settlements response shape

- `Admin\FinanceTest::test_finance_user_can_list_settlements`
- Route → `FinanceCommandCenterController::settlementIndex` (no root `meta.pagination`); ~`e002f5ea`

### TD-2026-09-12-B — Ops / dashboard maintenance & provider-offline visibility

- `OperationsProductFilterTest::test_ops_maintenance_keeps_catalog_visible_but_not_purchasable`
- `OperationsProviderPartnerTest::test_digiflazz_maintenance_marks_products_maintenance_vip_still_sellable`
- `OperationsProviderPartnerTest::test_provider_offline_hides_products_from_user_catalog`
- `OperationsUserDashboardIntegrationTest` (maintenance visibility variants)
- Conflict with purchasable-only customer catalog since `f1dd45e0` (2026-09-08)

### TD-2026-09-12-C — Multi-provider catalog / visibility fixtures

- `MultiProductProviderRuntimeTest` (catalog XL5K + sibling failover group)
- `ProductProviderVisibilityTest` (Digi/VIP on/off / merge variants)
- Fixture slug `pulsa-rt` / capability registry gaps vs `f1dd45e0` SoT

### TD-2026-09-12-D — Other pre-existing (same baseline count)

- `PajakNegaraFlowTest` / `TagihanPascaFlowTest` — `UniqueConstraintViolationException` in setup
- `PublicWebsiteApiTest` — seeded auth login
- `Sprint12SecurityKycTest` — 2FA OTP flows
- `VipTransactionStatusSyncTest` — expects title `Pembayaran Berhasil` vs actual `Pembelian Berhasil`

### Explicitly resolved (not debt)

- `CustomerProductCatalogFilterTest::test_i` updated to unmapped brand `Mystery Unmapped Game` (2026-09-12). Do **not** remove `game_profiles.pubg-mobile`.
- `phpunit.xml` `memory_limit=1024M` so full suite can finish (infra).
