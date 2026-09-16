# FR-FIN-10 — Alokasi Otomatis Pendapatan (Admin Fee + Margin)

**Status:** Implemented (2026-09-16)  
**Scope:** Web/dashboard Finance only (no APK)  
**SRS note:** Fitur baru di luar urutan sprint; dilanjutkan atas approval Owner. Melanjutkan gap FR-FIN-06/09 (Sprint 4) sebagai **FR-FIN-10**.

## Ringkasan

Setiap transaksi yang mencapai **SUCCESS**, sistem menghitung:

`allocable = max(0, transactions.admin_fee + Σ transaction_items.custom_metadata.margin)`

lalu membagi ke kategori menurut **rule set aktif** (total % harus 100). Snapshot `%` dan jumlah rupiah disimpan per transaksi agar histori tidak berubah saat rule diubah.

## Perilaku kunci

| Event | Perilaku |
|--------|----------|
| SUCCESS + rule set aktif | Entry `posted` + lines snapshot |
| SUCCESS tanpa rule set | Entry `skipped` + Finance alert `revenue_allocation_rules_missing`; TX customer tetap SUCCESS |
| Refund SUCCESS→REFUNDED | Entry `reversed`; tidak masuk akumulasi |
| Ubah % | Rule set baru `is_current=true`; set lama tetap di riwayat |
| Owner | Lihat saja (`EnsureOwnerReadOnly`); tulis = Finance / Super Admin |

## Default kategori (go-live)

VPS/Server 15%, Gaji 25%, Cadangan Pajak 10%, Isi Ulang Digiflazz 20%, Dana Darurat 10%, Pengembangan Aplikasi 10%, Keuntungan Pribadi 10%.

## API

- `GET /api/v1/admin/finance/revenue-allocation`
- `GET /api/v1/admin/finance/revenue-allocation/accumulation?from=&to=`
- `GET /api/v1/admin/finance/revenue-allocation/history`
- `PUT /api/v1/admin/finance/revenue-allocation/rules`
- `POST /api/v1/admin/finance/revenue-allocation/categories`
- `PUT /api/v1/admin/finance/revenue-allocation/categories/{id}`
- `POST /api/v1/admin/finance/revenue-allocation/categories/{id}/deactivate`

## UI

`/dashboard/finance/revenue-allocation` — tab Persentase / Akumulasi / Riwayat.
