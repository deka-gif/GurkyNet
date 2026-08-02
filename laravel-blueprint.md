# LARAVEL BACKEND ARCHITECTURE & BLUEPRINT DESIGN
## GURKYPAY CORE ENGINE (v1.0.0)

Dokumen ini mendefinisikan desain arsitektur fondasi backend berbasis Laravel untuk mendukung **Universal Checkout & Transaction Engine GurkyPay**. Struktur ini dirancang untuk dapat diimplementasikan langsung pada Laravel 11 tanpa memerlukan perubahan arsitektur dasar di masa depan.

---

## 1. FOLDER ARCHITECTURE (`app/`)

Struktur folder `app/` dirancang menggunakan kombinasi dari **Repository Pattern, Service Layer, dan Action Pattern (Domain-Driven Design)** untuk memisahkan urusan logika bisnis dari HTTP Controller.

```text
app/
├── Actions/
│   ├── Auth/
│   │   ├── AuthenticateUserAction.php
│   │   ├── RegisterCustomerAction.php
│   │   └── SendOtpAction.php
│   └── Transaction/
│       ├── CreateTransactionAction.php
│       ├── ProcessCheckoutAction.php
│       ├── DeductWalletBalanceAction.php
│       └── GenerateInvoiceCodeAction.php
├── DTO/
│   ├── Auth/
│   │   ├── LoginDto.php
│   │   └── RegisterDto.php
│   └── Transaction/
│       ├── CheckoutDataDto.php
│       └── TransactionQueryDto.php
├── Enums/
│   ├── TransactionStatus.php      # SUKSES, PENDING, GAGAL
│   ├── WalletHistoryType.php      # CREDIT, DEBIT
│   ├── UserRole.php              # OWNER, ADMIN, CUSTOMER
│   └── ServiceCategory.php       # PULSA, DATA, PLN, VOUCHER, TRANSFER, TAGIHAN, GAME, EWALLET
├── Events/
│   ├── TransactionCreated.php
│   ├── TransactionProcessed.php
│   ├── WalletBalanceDeducted.php
│   └── UserNotificationTriggered.php
├── Exceptions/
│   ├── InsufficientBalanceException.php
│   ├── InvalidTransactionPinException.php
│   ├── ProviderTimeoutException.php
│   └── OtpRateLimitException.php
├── Helpers/
│   └── CurrencyHelper.php
├── Http/
│   ├── Controllers/
│   │   └── Api/
│   │       └── v1/
│   │           ├── AuthController.php
│   │           ├── ProfileController.php
│   │           ├── WalletController.php
│   │           ├── ProductController.php
│   │           ├── TransactionController.php
│   │           ├── BannerController.php
│   │           └── NotificationController.php
│   ├── Middleware/
│   │   ├── EnsureUserHasRole.php
│   │   ├── EnsurePinVerified.php
│   │   └── ForceJsonResponse.php
│   └── Requests/
│       └── Api/
│           └── v1/
│               ├── LoginRequest.php
│               ├── RegisterRequest.php
│               ├── VerifyPinRequest.php
│               └── CheckoutRequest.php
├── Jobs/
│   ├── SyncDigiflazzProductsJob.php
│   ├── ProcessDigiflazzTransactionJob.php
│   ├── ProcessMidtransNotificationJob.php
│   ├── SendOtpSmsJob.php
│   └── CleanupExpiredOtpJob.php
├── Listeners/
│   ├── DeductWalletBalanceListener.php
│   ├── SendTransactionNotificationListener.php
│   └── LogActivityListener.php
├── Mail/
│   ├── TransactionReceiptMail.php
│   └── SecurityAlertMail.php
├── Models/
│   ├── User.php
│   ├── Wallet.php
│   ├── WalletHistory.php
│   ├── Transaction.php
│   ├── TransactionItem.php
│   ├── Product.php
│   ├── ProductCategory.php
│   ├── Provider.php
│   ├── DigiflazzProduct.php
│   ├── BannerPromotion.php
│   ├── Notification.php
│   ├── UserNotification.php
│   ├── Setting.php
│   ├── Faq.php
│   ├── Page.php
│   ├── ApkVersion.php
│   ├── OtpCode.php
│   ├── LoginLog.php
│   ├── ActivityLog.php
│   ├── PaymentHistory.php
│   ├── MidtransTransaction.php
│   └── DigiflazzTransaction.php
├── Notifications/
│   ├── TransactionSuccessNotification.php
│   ├── TransactionFailedNotification.php
│   └── SecurityCodeNotification.php
├── Observers/
│   ├── TransactionObserver.php
│   └── UserObserver.php
├── Policies/
│   ├── TransactionPolicy.php
│   └── WalletPolicy.php
├── Repositories/
│   ├── Contracts/
│   │   ├── UserRepositoryInterface.php
│   │   ├── TransactionRepositoryInterface.php
│   │   └── WalletRepositoryInterface.php
│   └── Eloquent/
│       ├── UserRepository.php
│       ├── TransactionRepository.php
│       └── WalletRepository.php
├── Services/
│   ├── Digiflazz/
│   │   └── DigiflazzService.php
│   ├── Midtrans/
│   │   └── MidtransService.php
│   ├── Notification/
│   │   └── PushNotificationService.php
│   └── Wallet/
│       └── BalanceManager.php
├── Traits/
│   ├── HasUuid.php
│   └── ApiResponseTrait.php
└── UseCases/
    └── ProcessCheckoutUseCase.php
```

---

## 2. DATABASE DESIGN & SCHEMA

Berikut adalah daftar seluruh tabel yang dibutuhkan beserta struktur relasi dan tipe datanya:

### A. Tabel Core Pengguna & Saldo
1. **`users`**
   - `id`: BIGINT (Primary Key, Auto Increment / UUID)
   - `name`: VARCHAR(255)
   - `email`: VARCHAR(255) (Unique)
   - `email_verified_at`: TIMESTAMP (Nullable)
   - `password`: VARCHAR(255)
   - `phone_number`: VARCHAR(20) (Unique)
   - `role`: VARCHAR(50) (Default: 'customer')
   - `transaction_pin`: VARCHAR(255) (Hashed, Nullable)
   - `remember_token`: VARCHAR(100) (Nullable)
   - `created_at` / `updated_at`: TIMESTAMP

2. **`wallets`**
   - `id`: BIGINT (Primary Key)
   - `user_id`: BIGINT (Foreign Key to `users.id`, Cascade)
   - `wallet_number`: VARCHAR(50) (Unique)
   - `balance`: DECIMAL(15, 2) (Default: 0.00)
   - `status`: VARCHAR(20) (Default: 'active')
   - `created_at` / `updated_at`: TIMESTAMP

3. **`wallet_histories`**
   - `id`: BIGINT (Primary Key)
   - `wallet_id`: BIGINT (Foreign Key to `wallets.id`, Cascade)
   - `amount`: DECIMAL(15, 2)
   - `type`: ENUM('credit', 'debit')
   - `description`: TEXT
   - `reference_id`: VARCHAR(100) (Nullable, reference to Transaction Invoice or Top Up ID)
   - `created_at`: TIMESTAMP

---

### B. Tabel Transaksi & Gerbang Pembayaran
4. **`transactions`**
   - `id`: BIGINT (Primary Key)
   - `user_id`: BIGINT (Foreign Key to `users.id`, Cascade)
   - `invoice_number`: VARCHAR(100) (Unique)
   - `service_name`: VARCHAR(100) # e.g. Pulsa, PLN, Voucher
   - `target_number`: VARCHAR(100) # Target HP, Meteran PLN, etc.
   - `amount`: DECIMAL(15, 2)     # Nominal dasar
   - `admin_fee`: DECIMAL(15, 2)  # Biaya admin
   - `total_payment`: DECIMAL(15, 2) # amount + admin_fee
   - `payment_method`: VARCHAR(50) # e.g. 'wallet', 'midtrans'
   - `status`: ENUM('sukses', 'pending', 'gagal') (Default: 'pending')
   - `notes`: TEXT (Nullable)
   - `created_at` / `updated_at`: TIMESTAMP

5. **`transaction_items`**
   - `id`: BIGINT (Primary Key)
   - `transaction_id`: BIGINT (Foreign Key to `transactions.id`, Cascade)
   - `product_code`: VARCHAR(100)
   - `product_name`: VARCHAR(255)
   - `price`: DECIMAL(15, 2)
   - `quantity`: INT (Default: 1)
   - `custom_metadata`: JSON (Nullable) # Menyimpan detail spesifik (Nama Pelanggan, Daya, Token PLN)
   - `created_at` / `updated_at`: TIMESTAMP

6. **`payment_histories`**
   - `id`: BIGINT (Primary Key)
   - `transaction_id`: BIGINT (Foreign Key to `transactions.id`, Cascade)
   - `gateway`: VARCHAR(50) # e.g. 'midtrans', 'wallet'
   - `payment_code`: VARCHAR(100) (Nullable)
   - `payload`: JSON (Nullable)
   - `response`: JSON (Nullable)
   - `status`: VARCHAR(50)
   - `created_at`: TIMESTAMP

7. **`midtrans_transactions`**
   - `id`: BIGINT (Primary Key)
   - `transaction_id`: BIGINT (Foreign Key to `transactions.id`, Cascade)
   - `order_id`: VARCHAR(100) (Unique)
   - `snap_token`: VARCHAR(255) (Nullable)
   - `payment_type`: VARCHAR(50) (Nullable)
   - `gross_amount`: DECIMAL(15, 2)
   - `transaction_status`: VARCHAR(50)
   - `raw_notification`: JSON (Nullable)
   - `created_at` / `updated_at`: TIMESTAMP

8. **`digiflazz_transactions`**
   - `id`: BIGINT (Primary Key)
   - `transaction_id`: BIGINT (Foreign Key to `transactions.id`, Cascade)
   - `ref_id`: VARCHAR(100) (Unique)
   - `buyer_sku_code`: VARCHAR(100)
   - `customer_no`: VARCHAR(100)
   - `sn`: VARCHAR(255) (Nullable)
   - `digiflazz_status`: VARCHAR(50) (Default: 'pending')
   - `raw_response`: JSON (Nullable)
   - `created_at` / `updated_at`: TIMESTAMP

---

### C. Tabel Produk & Provider
9. **`products`**
   - `id`: BIGINT (Primary Key)
   - `product_category_id`: BIGINT (Foreign Key to `product_categories.id`)
   - `sku_code`: VARCHAR(100) (Unique)
   - `name`: VARCHAR(255)
   - `base_price`: DECIMAL(15, 2)
   - `sell_price`: DECIMAL(15, 2)
   - `admin_fee`: DECIMAL(15, 2) (Default: 0.00)
   - `status`: BOOLEAN (Default: true)
   - `created_at` / `updated_at`: TIMESTAMP

10. **`product_categories`**
    - `id`: BIGINT (Primary Key)
    - `name`: VARCHAR(100) (e.g. 'Pulsa', 'Token PLN')
    - `slug`: VARCHAR(100) (Unique)
    - `icon`: VARCHAR(100) (Nullable)
    - `created_at` / `updated_at`: TIMESTAMP

11. **`providers`**
    - `id`: BIGINT (Primary Key)
    - `name`: VARCHAR(100) (e.g. 'Telkomsel', 'Indosat', 'PLN')
    - `logo`: VARCHAR(255) (Nullable)
    - `is_active`: BOOLEAN (Default: true)
    - `created_at` / `updated_at`: TIMESTAMP

12. **`digiflazz_products`**
    - `id`: BIGINT (Primary Key)
    - `buyer_sku_code`: VARCHAR(100) (Unique)
    - `product_name`: VARCHAR(255)
    - `category`: VARCHAR(100)
    - `brand`: VARCHAR(100)
    - `seller_price`: DECIMAL(15, 2)
    - `buyer_product_status`: BOOLEAN
    - `seller_product_status`: BOOLEAN
    - `unlimited_stock`: BOOLEAN
    - `desc`: TEXT (Nullable)
    - `created_at` / `updated_at`: TIMESTAMP

---

### D. Tabel Keamanan, Audit & CMS
13. **`otp_codes`**
    - `id`: BIGINT (Primary Key)
    - `phone_number`: VARCHAR(20)
    - `code`: VARCHAR(10)
    - `action`: VARCHAR(50) (e.g. 'register', 'reset_password')
    - `is_used`: BOOLEAN (Default: false)
    - `expires_at`: TIMESTAMP
    - `created_at`: TIMESTAMP

14. **`password_resets`**
    - `email`: VARCHAR(255) (Primary Key/Index)
    - `token`: VARCHAR(255)
    - `created_at`: TIMESTAMP

15. **`login_logs`**
    - `id`: BIGINT (Primary Key)
    - `user_id`: BIGINT (Foreign Key to `users.id`, Cascade)
    - `ip_address`: VARCHAR(45)
    - `user_agent`: VARCHAR(255)
    - `logged_at`: TIMESTAMP

16. **`activity_logs`**
    - `id`: BIGINT (Primary Key)
    - `user_id`: BIGINT (Foreign Key to `users.id`, Nullable, Cascade)
    - `activity`: VARCHAR(255)
    - `payload`: JSON (Nullable)
    - `created_at`: TIMESTAMP

17. **`banner_promotions`**
    - `id`: BIGINT (Primary Key)
    - `title`: VARCHAR(255)
    - `image_url`: VARCHAR(255)
    - `redirect_url`: VARCHAR(255) (Nullable)
    - `is_active`: BOOLEAN (Default: true)
    - `created_at` / `updated_at`: TIMESTAMP

18. **`notifications`**
    - `id`: BIGINT (Primary Key)
    - `title`: VARCHAR(255)
    - `message`: TEXT
    - `type`: VARCHAR(50) (e.g. 'broadcast', 'transaction')
    - `created_at` / `updated_at`: TIMESTAMP

19. **`user_notifications`**
    - `id`: BIGINT (Primary Key)
    - `user_id`: BIGINT (Foreign Key to `users.id`, Cascade)
    - `notification_id`: BIGINT (Foreign Key to `notifications.id`, Cascade)
    - `is_read`: BOOLEAN (Default: false)
    - `read_at`: TIMESTAMP (Nullable)
    - `created_at`: TIMESTAMP

20. **`settings`**
    - `id`: BIGINT (Primary Key)
    - `key`: VARCHAR(100) (Unique)
    - `value`: TEXT (Nullable)
    - `created_at` / `updated_at`: TIMESTAMP

21. **`faq`**
    - `id`: BIGINT (Primary Key)
    - `question`: TEXT
    - `answer`: TEXT
    - `order`: INT (Default: 0)
    - `created_at` / `updated_at`: TIMESTAMP

22. **`pages`**
    - `id`: BIGINT (Primary Key)
    - `title`: VARCHAR(255)
    - `slug`: VARCHAR(255) (Unique)
    - `content`: LONGTEXT
    - `created_at` / `updated_at`: TIMESTAMP

23. **`apk_versions`**
    - `id`: BIGINT (Primary Key)
    - `version_code`: INT
    - `version_name`: VARCHAR(50)
    - `download_url`: VARCHAR(255)
    - `is_force_update`: BOOLEAN (Default: false)
    - `release_notes`: TEXT (Nullable)
    - `created_at`: TIMESTAMP

---

## 3. MODEL RELATIONSHIPS

Berikut adalah relasi lengkap antar model (Eloquent ORM Relationship):

- **`User`**
  - `hasOne(Wallet::class)` -> Satu pengguna memiliki tepat satu saldo wallet.
  - `hasMany(Transaction::class)` -> Satu pengguna memiliki banyak transaksi.
  - `hasMany(LoginLog::class)` -> Satu pengguna memiliki banyak jejak login.
  - `hasMany(ActivityLog::class)` -> Satu pengguna memiliki banyak catatan aktivitas.
  - `hasMany(UserNotification::class)` -> Hubungan pivot ke notifikasi personal.

- **`Wallet`**
  - `belongsTo(User::class)` -> Dompet dimiliki oleh seorang pengguna.
  - `hasMany(WalletHistory::class)` -> Dompet mencatat mutasi debit/kredit saldo.

- **`WalletHistory`**
  - `belongsTo(Wallet::class)` -> Catatan riwayat mutasi merujuk pada satu dompet saldo.

- **`Transaction`**
  - `belongsTo(User::class)` -> Transaksi dikaitkan dengan satu pengguna.
  - `hasMany(TransactionItem::class)` -> Transaksi berisi satu atau beberapa item checkout.
  - `hasOne(PaymentHistory::class)` -> Memiliki satu riwayat pembayaran.
  - `hasOne(MidtransTransaction::class)` -> Memiliki satu detail transaksi Midtrans (jika bayar non-saldo).
  - `hasOne(DigiflazzTransaction::class)` -> Memiliki satu detail transaksi Digiflazz (jika produk PPOB).

- **`TransactionItem`**
  - `belongsTo(Transaction::class)` -> Item checkout merujuk ke satu transaksi utama.

- **`Product`**
  - `belongsTo(ProductCategory::class)` -> Produk terikat pada satu kategori (e.g. PLN).

- **`Notification`**
  - `hasMany(UserNotification::class)` -> Notifikasi utama dapat dikirim ke banyak user.

---

## 4. ROLE & PERMISSION MATRIX

GurkyPay membagi hak akses ke dalam 3 role utama yang dikelola melalui Spatie Laravel-Permission atau Middleware Kustom:

### A. Roles:
1. **`owner`** (Pemilik Sistem / Super Admin)
2. **`admin`** (Operasional & CS)
3. **`customer`** (Pengguna Aplikasi / End-User)

### B. Matrix Akses:

| Modul / Fitur | Owner | Admin | Customer |
| :--- | :---: | :---: | :---: |
| **Mengelola Admin & Staff** | ✅ | ❌ | ❌ |
| **Melihat Dashboard Keuangan & Laba** | ✅ | ✅ (Read Only) | ❌ |
| **Mengatur Profit / Harga Jual SKU** | ✅ | ✅ | ❌ |
| **Mengelola Banner & Promo** | ✅ | ✅ | ❌ |
| **Broadcast Notifikasi Global** | ✅ | ✅ | ❌ |
| **Melakukan Top-Up Manual untuk User** | ✅ | ✅ | ❌ |
| **Membaca Log Aktivitas Sistem** | ✅ | ✅ | ❌ |
| **Melakukan Transaksi PPOB** | ✅ | ✅ | ✅ |
| **Melihat Riwayat Saldo Sendiri** | ✅ | ✅ | ✅ |
| **Melihat Notifikasi Masuk Sendiri** | ✅ | ✅ | ✅ |
| **Mengubah PIN Transaksi Sendiri** | ✅ | ✅ | ✅ |

---

## 5. STORAGE CONFIGURATION (`config/filesystems.php`)

Disks kustom didefinisikan untuk merapikan penyimpanan berkas aset:

1. **`public`** (Default public assets)
   - Driver: `local`
   - Path: `storage_path('app/public')`
   - Visibility: `public`

2. **`banner_storage`** (Penyimpanan gambar Banner & Promosi)
   - Driver: `local`
   - Path: `storage_path('app/public/banners')`
   - URL: `env('APP_URL') . '/storage/banners'`

3. **`profile_storage`** (Penyimpanan foto profil user & verifikasi KYC)
   - Driver: `local` (atau S3 di production demi kepatuhan GDPR)
   - Path: `storage_path('app/private/profiles')`
   - Visibility: `private` (Mencegah akses publik langsung terhadap data KYC)

4. **`apk_storage`** (Penyimpanan file binary APK Android)
   - Driver: `local`
   - Path: `storage_path('app/public/apk')`
   - URL: `env('APP_URL') . '/storage/apk'`

---

## 6. QUEUE MANAGEMENT (`config/queue.php`)

Antrean asinkronus (menggunakan driver **Redis** di production, **database** di staging) wajib digunakan untuk menjaga kecepatan load-time aplikasi GurkyPay:

1. **`notification-queue`** (Koneksi: `redis`, Queue: `notifications`)
   - Memproses pengiriman OneSignal Push, Email Struk, dan SMS OTP.
   - Mengurangi hambatan respons HTTP saat login/checkout.

2. **`digiflazz-queue`** (Koneksi: `redis`, Queue: `digiflazz`)
   - Memproses pengiriman API pulsa/PLN ke Digiflazz secara asinkron.
   - Menghindari timeout HTTP jika provider eksternal lambat membalas.

3. **`midtrans-queue`** (Koneksi: `redis`, Queue: `midtrans`)
   - Memproses antrean webhook notifikasi pembayaran instan dari Midtrans untuk mengupdate status invoice dan menambah saldo wallet.

---

## 7. SCHEDULER DESIGN (`routes/console.php` atau `app/Console/Kernel.php`)

Jadwal otomatisasi berjalan tanpa henti untuk menjamin keselarasan harga produk dan kebersihan log:

```php
use App\Jobs\SyncDigiflazzProductsJob;
use App\Jobs\CleanupExpiredOtpJob;
use Illuminate\Support\Facades\Schedule;

// 1. Sinkronisasi SKU dan Status Stok dari Digiflazz (Setiap Hari jam 01:00 pagi)
Schedule::job(new SyncDigiflazzProductsJob)->dailyAt('01:00');

// 2. Sinkronisasi Harga Beli Digiflazz & Auto Update Harga Jual (Setiap 6 Jam)
Schedule::command('ppob:sync-prices')->everySixHours();

// 3. Verifikasi Status Transaksi Pending ke API Provider (Setiap 5 Menit)
Schedule::command('ppob:check-pending-transactions')->everyFiveMinutes();

// 4. Pembersihan Kode OTP kedaluwarsa & tidak terpakai (Setiap Jam)
Schedule::job(new CleanupExpiredOtpJob)->hourly();

// 5. Pembersihan Log Aktivitas Lama > 90 hari (Setiap Minggu)
Schedule::command('logs:clean --days=90')->weekly();
```

---

## 8. API VERSIONING & GATEWAY STRATEGY

Seluruh endpoint diposisikan di bawah rute `/api/v1/` dengan aturan ketat:
- URL: `https://api.gurkypay.com/api/v1/...`
- Header: 
  - `Accept: application/json`
  - `Content-Type: application/json`

---

## 9. AUTHENTICATION FLOWS (Laravel Sanctum)

GurkyPay mengandalkan **Laravel Sanctum** untuk sistem otentikasi ganda:

1. **Aplikasi Mobile / Web SPA**: Menggunakan Stateful Cookie Authentication (Session & CSRF Cookie) yang terintegrasi dengan mulus di browser web.
2. **REST API Client / Bearer Fallback**: Menggunakan token Sanctum (`PersonalAccessToken`) yang diletakkan pada header `Authorization: Bearer <token>`.
3. **Remember Me**: Memanfaatkan token Sanctum awet dengan masa berlaku 1 tahun untuk kenyamanan pengguna mobile.
4. **OTP Login**: Kode OTP 6 digit dikirim via WhatsApp/SMS, diverifikasi sekali pakai, kemudian melahirkan token otentikasi Sanctum baru.

---

## 10. API RESPONSE STANDARD (Sesuai Kontrak Sprint 7)

Seluruh response wajib dibungkus oleh Trait `ApiResponseTrait` untuk memastikan format JSON seragam dengan antarmuka frontend:

### A. Response Sukses Standard (`LaravelResponse<T>`)
```json
{
  "success": true,
  "message": "Registrasi customer berhasil.",
  "data": {
    "user": {
      "id": 15,
      "name": "Gurky Adipati",
      "email": "adipati@gurky.com",
      "phone_number": "08123456789"
    }
  }
}
```

### B. Response Pagination Standard (`PaginationResponse<T>`)
```json
{
  "success": true,
  "message": "Mendapatkan daftar riwayat transaksi.",
  "data": [
    {
      "id": 105,
      "invoice_number": "TRX-20260730-8910",
      "service_name": "Token PLN",
      "total_payment": 52500,
      "status": "sukses",
      "created_at": "2026-07-30T15:00:00Z"
    }
  ],
  "meta": {
    "current_page": 1,
    "last_page": 12,
    "per_page": 10,
    "total": 115,
    "path": "https://api.gurkypay.com/api/v1/transactions",
    "from": 1,
    "to": 10
  },
  "links": {
    "first": "https://api.gurkypay.com/api/v1/transactions?page=1",
    "last": "https://api.gurkypay.com/api/v1/transactions?page=12",
    "prev": null,
    "next": "https://api.gurkypay.com/api/v1/transactions?page=2"
  }
}
```

### C. Response Error Validasi (`ValidationErrorResponse`)
```json
{
  "success": false,
  "message": "Data yang dikirimkan tidak valid.",
  "errors": {
    "phone_number": [
      "Nomor handphone harus diawali dengan angka 08.",
      "Nomor handphone sudah terdaftar di sistem."
    ]
  }
}
```

---
**PONDASI BACKEND LARAVEL SELESAI DIRANCANG.**
*Arsitektur ini telah disinkronisasikan sepenuhnya dengan modul Universal Checkout, PIN Transaksi, dan Halaman Riwayat pada antarmuka frontend.*
