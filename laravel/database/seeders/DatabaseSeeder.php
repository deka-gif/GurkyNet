<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Wallet;
use App\Models\ProductCategory;
use App\Models\Product;
use App\Models\BannerPromotion;
use App\Models\Notification;
use App\Models\WebsiteSetting;
use App\Models\HomepageSection;
use App\Models\WebsiteMenu;
use App\Models\StaticPage;
use App\Models\Faq;
use App\Models\Setting;
use App\Models\Provider;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // 1. Roles & Permissions seeding (Simulating Spatie Permission setup)
        // In Spatie, we usually do Role::create(['name' => 'owner']) etc.
        // We will seed the role strings inside the users table as defined in migration.

        $this->command->info('Seeding Roles & Default Users...');

        // 1. SUPER ADMIN
        $superAdmin = User::create([
            'name' => 'Root System Master (Super Admin)',
            'email' => 'admin@gurkypay.com',
            'phone_number' => '080000000000',
            'password' => Hash::make('admin123'),
            'role' => \App\Enums\UserRole::SUPER_ADMIN,
            'transaction_pin' => Hash::make('123456'),
        ]);
        Wallet::create([
            'user_id' => $superAdmin->id,
            'wallet_number' => '104288880000',
            'balance' => 999999999.00,
            'status' => 'active',
        ]);

        // 2. OWNER
        $owner = User::create([
            'name' => 'Gurky Adipati (Owner)',
            'email' => 'owner@gurkypay.com',
            'phone_number' => '081111111111',
            'password' => Hash::make('owner123'),
            'role' => \App\Enums\UserRole::OWNER,
            'transaction_pin' => Hash::make('123456'),
        ]);
        Wallet::create([
            'user_id' => $owner->id,
            'wallet_number' => '104288880001',
            'balance' => 99999999.00,
            'status' => 'active',
        ]);

        // 3. FINANCE
        $finance = User::create([
            'name' => 'Siti Nurhaliza (Finance)',
            'email' => 'finance@gurkypay.com',
            'phone_number' => '082222222222',
            'password' => Hash::make('finance123'),
            'role' => \App\Enums\UserRole::FINANCE,
            'transaction_pin' => Hash::make('123456'),
        ]);
        Wallet::create([
            'user_id' => $finance->id,
            'wallet_number' => '104288880002',
            'balance' => 50000000.00,
            'status' => 'active',
        ]);

        // 4. OPERATIONS
        $operations = User::create([
            'name' => 'Bambang Tri (Operations)',
            'email' => 'operations@gurkypay.com',
            'phone_number' => '083333333333',
            'password' => Hash::make('ops123'),
            'role' => \App\Enums\UserRole::OPERATIONS,
            'transaction_pin' => Hash::make('123456'),
        ]);
        Wallet::create([
            'user_id' => $operations->id,
            'wallet_number' => '104288880003',
            'balance' => 10000000.00,
            'status' => 'active',
        ]);

        // 5. MARKETING
        $marketing = User::create([
            'name' => 'Dewi Lestari (Marketing)',
            'email' => 'marketing@gurkypay.com',
            'phone_number' => '084444444444',
            'password' => Hash::make('mkt123'),
            'role' => \App\Enums\UserRole::MARKETING,
            'transaction_pin' => Hash::make('123456'),
        ]);
        Wallet::create([
            'user_id' => $marketing->id,
            'wallet_number' => '104288880004',
            'balance' => 5000000.00,
            'status' => 'active',
        ]);

        // 6. CUSTOMER SUPPORT
        $cs = User::create([
            'name' => 'Anisa Rahma (Customer Support)',
            'email' => 'cs@gurkypay.com',
            'phone_number' => '085555555555',
            'password' => Hash::make('cs123'),
            'role' => \App\Enums\UserRole::CUSTOMER_SUPPORT,
            'transaction_pin' => Hash::make('123456'),
        ]);
        Wallet::create([
            'user_id' => $cs->id,
            'wallet_number' => '104288880005',
            'balance' => 2000000.00,
            'status' => 'active',
        ]);

        // 7. REGULAR USER
        $user = User::create([
            'name' => 'Budi Setiawan (Regular User)',
            'email' => 'user@gurkypay.com',
            'phone_number' => '088888888888',
            'password' => Hash::make('user123'),
            'role' => \App\Enums\UserRole::USER,
            'transaction_pin' => Hash::make('123456'),
        ]);
        Wallet::create([
            'user_id' => $user->id,
            'wallet_number' => '104230009182',
            'balance' => 250000.00,
            'status' => 'active',
        ]);

        // Seed 10 more random customer dummies using User and Wallet Factories
        User::factory(10)->create()->each(function ($user) {
            Wallet::create([
                'user_id' => $user->id,
                'wallet_number' => '1042' . mt_rand(1000000000, 9999999999),
                'balance' => mt_rand(5000, 1500000),
                'status' => 'active',
            ]);
        });


        // 1.5 Providers seeding
        $this->command->info('Seeding Providers...');
        $providerNames = ['Telkomsel', 'Indosat', 'XL', 'Axis', 'Tri', 'Smartfren', 'PLN', 'PDAM', 'BPJS', 'Steam', 'Google Play'];
        $providerModels = [];
        foreach ($providerNames as $name) {
            $providerModels[strtolower($name)] = Provider::create([
                'name' => $name,
                'logo' => strtolower(str_replace(' ', '_', $name)) . '.png',
                'is_active' => true,
            ]);
        }

        // 2. Product Categories seeding
        $this->command->info('Seeding Product Categories...');
        $categories = [
            ['name' => 'Pulsa Seluler', 'slug' => 'pulsa-seluler', 'icon' => 'phone-call'],
            ['name' => 'Paket Data', 'slug' => 'paket-data', 'icon' => 'wifi'],
            ['name' => 'Token PLN', 'slug' => 'token-pln', 'icon' => 'zap'],
            ['name' => 'Voucher Belanja', 'slug' => 'voucher-belanja', 'icon' => 'shopping-bag'],
            ['name' => 'Tagihan Bulanan', 'slug' => 'tagihan-bulanan', 'icon' => 'credit-card'],
        ];

        $categoryModels = [];
        foreach ($categories as $cat) {
            $categoryModels[$cat['slug']] = ProductCategory::create($cat);
        }


        // 3. Products Dummy seeding
        $this->command->info('Seeding Products...');
        
        // Pulsa products
        $pulsaNominals = [5000, 10000, 20000, 50000, 100000];
        foreach ($pulsaNominals as $nominal) {
            Product::create([
                'product_category_id' => $categoryModels['pulsa-seluler']->id,
                'provider_id' => $providerModels['telkomsel']->id,
                'sku_code' => 'PULSA-TSEL-' . $nominal,
                'name' => 'Telkomsel Pulsa Rp ' . number_format($nominal, 0, ',', '.'),
                'base_price' => $nominal,
                'sell_price' => $nominal + 1500,
                'admin_fee' => 0,
                'status' => true,
            ]);
            Product::create([
                'product_category_id' => $categoryModels['pulsa-seluler']->id,
                'provider_id' => $providerModels['indosat']->id,
                'sku_code' => 'PULSA-ISAT-' . $nominal,
                'name' => 'Indosat Ooredoo Pulsa Rp ' . number_format($nominal, 0, ',', '.'),
                'base_price' => $nominal,
                'sell_price' => $nominal + 1200,
                'admin_fee' => 0,
                'status' => true,
            ]);
        }

        // Token PLN products
        $plnNominals = [20000, 50000, 100000, 200000, 500000];
        foreach ($plnNominals as $nominal) {
            Product::create([
                'product_category_id' => $categoryModels['token-pln']->id,
                'provider_id' => $providerModels['pln']->id,
                'sku_code' => 'PLNPRE-' . $nominal,
                'name' => 'PLN Prepaid Rp ' . number_format($nominal, 0, ',', '.'),
                'base_price' => $nominal,
                'sell_price' => $nominal,
                'admin_fee' => 2500,
                'status' => true,
            ]);
        }

        // Voucher Belanja products
        Product::create([
            'product_category_id' => $categoryModels['voucher-belanja']->id,
            'provider_id' => $providerModels['google play']->id ?? null,
            'sku_code' => 'VCH-ALFA-50K',
            'name' => 'Voucher Alfamart Digital Rp 50.000',
            'base_price' => 48500,
            'sell_price' => 49500,
            'admin_fee' => 0,
            'status' => true,
        ]);
        Product::create([
            'product_category_id' => $categoryModels['voucher-belanja']->id,
            'provider_id' => $providerModels['steam']->id ?? null,
            'sku_code' => 'VCH-INDOM-100K',
            'name' => 'Voucher Indomaret Fisik Rp 100.000',
            'base_price' => 97000,
            'sell_price' => 98500,
            'admin_fee' => 0,
            'status' => true,
        ]);


        // 4. Banner, Promotions, and Vouchers seeding
        $this->command->info('Seeding Banners, Promotions, and Vouchers...');
        // Banners
        BannerPromotion::create([
            'type' => 'banner',
            'title' => 'Promo Cashback Akhir Bulan 10%',
            'image_url' => 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=1200&q=80',
            'redirect_url' => '/promo/cashback',
            'is_active' => true,
        ]);
        BannerPromotion::create([
            'type' => 'banner',
            'title' => 'Nikmati Bebas Biaya Admin Token Listrik PLN',
            'image_url' => 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=1200&q=80',
            'redirect_url' => '/layanan/token-pln',
            'is_active' => true,
        ]);
        BannerPromotion::create([
            'type' => 'banner',
            'title' => 'Top Up Diamond Game Instan 24 Jam Nonstop',
            'image_url' => 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1200&q=80',
            'redirect_url' => '/layanan/voucher-game',
            'is_active' => true,
        ]);

        // Promotions
        BannerPromotion::create([
            'type' => 'promotion',
            'title' => 'Flash Sale Paket Data Telkomsel & Indosat',
            'code' => 'FLASHDATA',
            'description' => 'Potongan harga Rp 5.000 untuk pembelian paket data minimal 50GB.',
            'discount_amount' => 5000,
            'discount_type' => 'fixed',
            'min_transaction' => 50000,
            'quota' => 500,
            'used_count' => 32,
            'image_url' => 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=1200&q=80',
            'redirect_url' => '/promo/flash-data',
            'is_active' => true,
        ]);
        BannerPromotion::create([
            'type' => 'promotion',
            'title' => 'Diskon Spesial Tagihan BPJS & PDAM',
            'code' => 'HEMATTAGIHAN',
            'description' => 'Cashback 5% hingga Rp 10.000 untuk pembayaran tagihan bulanan keluarga.',
            'discount_amount' => 10000,
            'discount_type' => 'fixed',
            'min_transaction' => 100000,
            'quota' => 250,
            'used_count' => 14,
            'image_url' => 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=1200&q=80',
            'redirect_url' => '/promo/tagihan-bulanan',
            'is_active' => true,
        ]);

        // Vouchers
        BannerPromotion::create([
            'type' => 'voucher',
            'title' => 'Voucher Pengguna Baru GurkyNet',
            'code' => 'GURKYBARU',
            'description' => 'Klaim saldo bonus Rp 10.000 untuk transaksi pertama setelah verifikasi akun.',
            'discount_amount' => 10000,
            'discount_type' => 'fixed',
            'min_transaction' => 25000,
            'quota' => 1000,
            'used_count' => 128,
            'image_url' => 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1200&q=80',
            'redirect_url' => '/voucher/pengguna-baru',
            'is_active' => true,
        ]);
        BannerPromotion::create([
            'type' => 'voucher',
            'title' => 'Voucher Weekend Seru Top Up Game',
            'code' => 'GURKYGAME',
            'description' => 'Diskon 15% maksimal Rp 15.000 untuk top up Mobile Legends dan Free Fire setiap Sabtu-Minggu.',
            'discount_amount' => 15000,
            'discount_type' => 'percentage',
            'min_transaction' => 30000,
            'quota' => 300,
            'used_count' => 45,
            'image_url' => 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=1200&q=80',
            'redirect_url' => '/voucher/weekend-game',
            'is_active' => true,
        ]);


        // 5. Notifications (Announcement Center) seeding
        $this->command->info('Seeding Notifications & Announcements...');
        Notification::create([
            'title' => 'Peningkatan Sistem & Keamanan Server GurkyNet',
            'message' => 'Sistem pembayaran GurkyNet kini telah dioptimalkan dengan sertifikasi keamanan end-to-end terkini untuk menjamin kenyamanan transaksi Anda.',
            'type' => 'broadcast',
            'is_active' => true,
        ]);
        Notification::create([
            'title' => 'Jadwal Pemeliharaan Rutin Bank BCA & Mandiri',
            'message' => 'Layanan Virtual Account Bank BCA dan Mandiri beroperasi normal 24 jam. Segala transaksi otomatis terkonfirmasi dalam hitungan detik.',
            'type' => 'announcement',
            'is_active' => true,
        ]);
        Notification::create([
            'title' => 'Dukungan Metode Pembayaran QRIS Nasional',
            'message' => 'Sekarang Anda dapat melakukan isi ulang saldo dompet digital GurkyNet secara instan melalui QRIS semua bank dan e-wallet.',
            'type' => 'promo',
            'is_active' => true,
        ]);


        // 6. Website Settings seeding
        $this->command->info('Seeding Website Settings...');
        WebsiteSetting::create([
            'website_name' => 'GurkyNet',
            'tagline' => 'Platform PPOB & Solusi Pembayaran Digital Tercepat di Indonesia',
            'logo' => '/assets/logo.png',
            'logo_dark' => '/assets/logo-dark.png',
            'favicon' => '/favicon.ico',
            'support_email' => 'support@gurkynet.com',
            'support_phone' => '+62 812-3456-7890',
            'whatsapp' => '6281234567890',
            'office_address' => 'Jl. Gatot Subroto No. 88, Kav. 12, Kuningan Barat, Mampang Prapatan, Jakarta Selatan, DKI Jakarta 12710',
            'google_maps_url' => 'https://maps.google.com/?q=Jakarta',
            'facebook' => 'https://facebook.com/gurkynet',
            'instagram' => 'https://instagram.com/gurkynet',
            'tiktok' => 'https://tiktok.com/@gurkynet',
            'youtube' => 'https://youtube.com/@gurkynet',
            'twitter' => 'https://x.com/gurkynet',
            'copyright' => '© 2026 PT Gurky Solusi Digital. Hak cipta dilindungi undang-undang.',
            'maintenance_mode' => false,
            'timezone' => 'Asia/Jakarta',
            'currency' => 'IDR',
            'language' => 'id',
        ]);


        // 7. Homepage Sections seeding
        $this->command->info('Seeding Homepage Sections...');
        $sections = [
            [
                'title' => 'Hero Banner Utama',
                'slug' => 'hero-banner',
                'component_type' => 'hero',
                'display_order' => 1,
                'visible' => true,
                'status' => 'active',
                'description' => 'Headline utama selamat datang dan ajakan bertransaksi di GurkyNet.',
            ],
            [
                'title' => 'Tentang GurkyNet',
                'slug' => 'tentang-gurkynet',
                'component_type' => 'news',
                'display_order' => 2,
                'visible' => true,
                'status' => 'active',
                'description' => 'Profil singkat keunggulan dan integritas platform GurkyNet.',
            ],
            [
                'title' => 'Fitur Unggulan',
                'slug' => 'fitur-unggulan',
                'component_type' => 'promo',
                'display_order' => 3,
                'visible' => true,
                'status' => 'active',
                'description' => 'Kecepatan transaksi, keamanan berlapis, dan layanan 24/7.',
            ],
            [
                'title' => 'Katalog Layanan & Produk',
                'slug' => 'katalog-layanan',
                'component_type' => 'categories',
                'display_order' => 4,
                'visible' => true,
                'status' => 'active',
                'description' => 'Pulsa, paket data, PLN, voucher game, dan tagihan PPOB.',
            ],
            [
                'title' => 'Aplikasi Mobile & Promo Banner',
                'slug' => 'aplikasi-mobile-promo',
                'component_type' => 'banner',
                'display_order' => 5,
                'visible' => true,
                'status' => 'active',
                'description' => 'Tampilan aplikasi mobile Android/iOS dan promo eksklusif.',
            ],
            [
                'title' => 'Pertanyaan Umum (FAQ)',
                'slug' => 'pertanyaan-umum',
                'component_type' => 'faq',
                'display_order' => 6,
                'visible' => true,
                'status' => 'active',
                'description' => 'Jawaban atas pertanyaan yang paling sering diajukan pelanggan.',
            ],
            [
                'title' => 'Hubungi Kami & Informasi Kontak',
                'slug' => 'hubungi-kami',
                'component_type' => 'announcement',
                'display_order' => 7,
                'visible' => true,
                'status' => 'active',
                'description' => 'Saluran bantuan customer support, WhatsApp, dan lokasi kantor.',
            ],
        ];

        foreach ($sections as $section) {
            HomepageSection::create($section);
        }


        // 8. Website Navigation Menus seeding
        $this->command->info('Seeding Website Menus...');
        $menus = [
            ['title' => 'Beranda', 'slug' => 'beranda', 'url' => '/', 'icon' => 'home', 'display_order' => 1, 'visible' => true, 'open_in_new_tab' => false],
            ['title' => 'Layanan', 'slug' => 'layanan', 'url' => '#services', 'icon' => 'grid', 'display_order' => 2, 'visible' => true, 'open_in_new_tab' => false],
            ['title' => 'Fitur', 'slug' => 'fitur', 'url' => '#features', 'icon' => 'sparkles', 'display_order' => 3, 'visible' => true, 'open_in_new_tab' => false],
            ['title' => 'Tentang Kami', 'slug' => 'tentang', 'url' => '#about', 'icon' => 'info', 'display_order' => 4, 'visible' => true, 'open_in_new_tab' => false],
            ['title' => 'FAQ', 'slug' => 'faq', 'url' => '#faq', 'icon' => 'help-circle', 'display_order' => 5, 'visible' => true, 'open_in_new_tab' => false],
            ['title' => 'Kontak', 'slug' => 'kontak', 'url' => '#contact', 'icon' => 'phone', 'display_order' => 6, 'visible' => true, 'open_in_new_tab' => false],
        ];

        foreach ($menus as $menu) {
            WebsiteMenu::create($menu);
        }


        // 9. Static Pages seeding
        $this->command->info('Seeding Static Pages...');
        $staticPages = [
            [
                'title' => 'Tentang Kami',
                'slug' => 'about-us',
                'seo_title' => 'Tentang GurkyNet - Platform PPOB & Top Up Game Terpercaya',
                'seo_description' => 'Pelajari lebih lanjut tentang GurkyNet, visi, misi, dan komitmen kami dalam memberikan layanan transaksi digital terbaik di Indonesia.',
                'content' => '<h3>Selamat Datang di GurkyNet</h3><p>GurkyNet adalah platform agregator layanan PPOB (Payment Point Online Bank) dan produk digital terdepan di Indonesia. Kami hadir untuk memudahkan masyarakat dan pelaku UMKM dalam melakukan transaksi kebutuhan digital harian seperti pulsa seluler, paket data internet, token PLN, voucher game, hingga pembayaran tagihan bulanan BPJS, PDAM, dan multifinance secara instan, aman, dan dengan harga termurah.</p><h4>Visi Kami</h4><p>Menjadi ekosistem pembayaran digital nomor satu yang memberdayakan jutaan pengguna dan agen digital di seluruh pelosok Indonesia melalui teknologi yang andal, cepat, dan transparan.</p><h4>Misi Kami</h4><ul><li>Menyediakan infrastruktur transaksi dengan uptime 99.9% dan proses secepat kilat.</li><li>Menghadirkan harga produk digital yang sangat kompetitif untuk memaksimalkan keuntungan mitra agen.</li><li>Memberikan layanan bantuan pelanggan (Customer Support) yang responsif dan siap membantu 24/7.</li></ul>',
                'status' => 'published',
                'published_at' => now(),
            ],
            [
                'title' => 'Kebijakan Privasi',
                'slug' => 'privacy-policy',
                'seo_title' => 'Kebijakan Privasi - GurkyNet',
                'seo_description' => 'Informasi mengenai bagaimana GurkyNet mengumpulkan, menggunakan, dan melindungi data pribadi Anda.',
                'content' => '<h3>Kebijakan Privasi GurkyNet</h3><p>PT Gurky Solusi Digital ("GurkyNet") berkomitmen penuh untuk melindungi privasi dan keamanan data pribadi setiap pengguna layanan kami. Kebijakan Privasi ini menjelaskan bagaimana data Anda dikumpulkan, disimpan, diproses, dan dilindungi saat menggunakan situs web dan aplikasi GurkyNet.</p><h4>1. Data yang Kami Kumpulkan</h4><p>Kami mengumpulkan data akun (nama lengkap, nomor telepon, alamat email, PIN transaksi) dan riwayat transaksi untuk memproses pesanan dan mematuhi regulasi keuangan yang berlaku di Republik Indonesia.</p><h4>2. Keamanan Data</h4><p>Seluruh transmisi data dilindungi dengan enkripsi SSL/TLS 256-bit dan password serta PIN transaksi disimpan menggunakan algoritma hashing standar industri yang aman.</p>',
                'status' => 'published',
                'published_at' => now(),
            ],
            [
                'title' => 'Syarat dan Ketentuan',
                'slug' => 'terms-conditions',
                'seo_title' => 'Syarat dan Ketentuan Layanan - GurkyNet',
                'seo_description' => 'Syarat dan ketentuan umum penggunaan aplikasi dan situs web GurkyNet.',
                'content' => '<h3>Syarat & Ketentuan Layanan GurkyNet</h3><p>Dengan mendaftar, mengakses, atau menggunakan layanan GurkyNet, Anda menyatakan bahwa Anda telah membaca, memahami, dan menyetujui untuk terikat oleh Syarat dan Ketentuan ini.</p><h4>1. Pendaftaran dan Keamanan Akun</h4><p>Pengguna wajib memberikan informasi yang akurat saat registrasi. Pengguna bertanggung jawab penuh untuk menjaga kerahasiaan kata sandi dan PIN transaksi akun masing-masing.</p><h4>2. Transaksi dan Pembayaran</h4><p>Setiap transaksi produk digital yang telah berstatus sukses tidak dapat dibatalkan, kecuali terjadi kegagalan sistem dari sisi provider eksternal yang akan direfund secara otomatis ke saldo dompet digital Anda.</p>',
                'status' => 'published',
                'published_at' => now(),
            ],
            [
                'title' => 'Kebijakan Pengembalian Dana (Refund)',
                'slug' => 'refund-policy',
                'seo_title' => 'Kebijakan Refund dan Pengembalian Dana - GurkyNet',
                'seo_description' => 'Panduan lengkap mengenai kebijakan dan prosedur pengembalian dana transaksi di GurkyNet.',
                'content' => '<h3>Kebijakan Pengembalian Dana (Refund)</h3><p>Kepuasan dan kenyamanan pengguna adalah prioritas utama GurkyNet. Kami menjamin perlindungan saldo untuk seluruh transaksi yang dilakukan melalui platform kami.</p><h4>Ketentuan Refund Otomatis</h4><p>Jika transaksi produk digital dinyatakan gagal oleh provider penyedia layanan (misal: nomor tujuan hangus, gangguan server provider, atau produk out of stock), sistem kami akan mengembalikan dana 100% secara instan ke saldo dompet GurkyNet Anda tanpa potongan biaya admin.</p>',
                'status' => 'published',
                'published_at' => now(),
            ],
        ];

        foreach ($staticPages as $page) {
            StaticPage::create($page);
        }


        // 10. FAQ seeding
        $this->command->info('Seeding FAQ list...');
        Faq::create([
            'question' => 'Bagaimana cara mengisi saldo (top up) dompet GurkyNet?',
            'answer' => 'Anda dapat mengisi saldo melalui transfer bank virtual account (BCA, Mandiri, BRI, BNI), QRIS instan, atau melalui gerai Alfamart/Indomaret terdekat menggunakan sistem pembayaran otomatis Midtrans.',
            'order' => 1,
        ]);
        Faq::create([
            'question' => 'Berapa lama waktu proses transaksi produk digital di GurkyNet?',
            'answer' => 'Transaksi pulsa, paket data, dan token PLN diproses secara instan otomatis oleh server kami dalam hitungan 1-5 detik setelah pembayaran terkonfirmasi.',
            'order' => 2,
        ]);
        Faq::create([
            'question' => 'Bagaimana jika transaksi saya gagal atau salah nomor tujuan?',
            'answer' => 'Jika transaksi gagal diproses oleh sistem provider, saldo Anda akan otomatis direfund 100% kembali ke saldo dompet GurkyNet. Pastikan nomor tujuan selalu dicek kembali sebelum konfirmasi pembayaran.',
            'order' => 3,
        ]);
        Faq::create([
            'question' => 'Apakah GurkyNet menyediakan layanan bantuan Customer Support 24 jam?',
            'answer' => 'Ya, tim Customer Support kami siap membantu Anda 24 jam sehari, 7 hari seminggu melalui live chat WhatsApp dan sistem tiket bantuan di dalam dashboard.',
            'order' => 4,
        ]);


        // 11. Settings Default seeding
        $this->command->info('Seeding Global Settings...');
        Setting::create(['key' => 'app_name', 'value' => 'GurkyNet']);
        Setting::create(['key' => 'app_logo', 'value' => '/assets/logo.png']);
        Setting::create(['key' => 'maintenance_mode', 'value' => 'false']);
        Setting::create(['key' => 'digiflazz_username', 'value' => 'gurkynet_production']);
        Setting::create(['key' => 'midtrans_merchant_id', 'value' => 'M104283948']);

        $this->command->info('Database seeding completed successfully!');
    }
}
