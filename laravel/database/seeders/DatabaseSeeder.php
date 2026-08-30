<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Wallet;
use App\Models\ProductCategory;
use App\Models\BannerPromotion;
use App\Models\Notification;
use App\Models\WebsiteSetting;
use App\Models\HomepageSection;
use App\Models\WebsiteMenu;
use App\Models\StaticPage;
use App\Models\Faq;
use App\Models\Setting;
use App\Models\SystemSetting;
use App\Models\Media;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database idempotently.
     */
    public function run(): void
    {
        // 1. MEDIA PLACEHOLDERS (Must seed early for foreign key relations)
        $this->command?->info('Seeding Media library...');
        $mediaLogo = Media::updateOrCreate(
            ['filename' => 'gurkynet-logo.png'],
            [
                'original_name' => 'gurkynet-logo.png',
                'mime_type' => 'image/png',
                'extension' => 'png',
                'size' => 12450,
                'width' => 512,
                'height' => 512,
                'alt_text' => 'GurkyNet Official Logo',
                'folder' => 'logo',
                'storage_disk' => 'public',
                'url' => '/assets/logo.png',
                'uploaded_by' => 'system',
            ]
        );

        $mediaLogoDark = Media::updateOrCreate(
            ['filename' => 'gurkynet-logo-dark.png'],
            [
                'original_name' => 'gurkynet-logo-dark.png',
                'mime_type' => 'image/png',
                'extension' => 'png',
                'size' => 13120,
                'width' => 512,
                'height' => 512,
                'alt_text' => 'GurkyNet Dark Logo',
                'folder' => 'logo',
                'storage_disk' => 'public',
                'url' => '/assets/logo-dark.png',
                'uploaded_by' => 'system',
            ]
        );

        $mediaFavicon = Media::updateOrCreate(
            ['filename' => 'gurkynet-favicon.ico'],
            [
                'original_name' => 'favicon.ico',
                'mime_type' => 'image/x-icon',
                'extension' => 'ico',
                'size' => 4500,
                'width' => 64,
                'height' => 64,
                'alt_text' => 'GurkyNet Favicon',
                'folder' => 'favicon',
                'storage_disk' => 'public',
                'url' => '/favicon.ico',
                'uploaded_by' => 'system',
            ]
        );

        $mediaHero = Media::updateOrCreate(
            ['filename' => 'hero-banner-illustration.png'],
            [
                'original_name' => 'hero-banner-illustration.png',
                'mime_type' => 'image/png',
                'extension' => 'png',
                'size' => 45020,
                'width' => 1200,
                'height' => 600,
                'alt_text' => 'Hero Banner Illustration GurkyNet',
                'folder' => 'banner',
                'storage_disk' => 'public',
                'url' => 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=1200&q=80',
                'uploaded_by' => 'system',
            ]
        );

        // 2. WEBSITE SETTINGS (Critical for public API endpoints)
        $this->command?->info('Seeding Website Settings...');
        $websiteSettingData = [
            'website_name' => 'GurkyNet',
            'tagline' => 'Platform PPOB & Solusi Pembayaran Digital Tercepat di Indonesia',
            'logo' => '/assets/logo.png',
            'logo_dark' => '/assets/logo-dark.png',
            'favicon' => '/favicon.ico',
            'logo_media_id' => $mediaLogo?->id,
            'logo_dark_media_id' => $mediaLogoDark?->id,
            'favicon_media_id' => $mediaFavicon?->id,
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
        ];

        $existingSetting = WebsiteSetting::first();
        if ($existingSetting) {
            $existingSetting->update($websiteSettingData);
        } else {
            WebsiteSetting::create($websiteSettingData);
        }

        // 3. HOMEPAGE SECTIONS
        $this->command?->info('Seeding Homepage Sections...');
        $sections = [
            [
                'title' => 'Hero Banner Utama',
                'slug' => 'hero-banner',
                'component_type' => 'hero',
                'display_order' => 1,
                'visible' => true,
                'status' => 'active',
                'description' => 'Headline utama selamat datang dan ajakan bertransaksi di GurkyNet.',
                'hero_background_media_id' => $mediaHero?->id,
                'hero_illustration_media_id' => $mediaHero?->id,
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
            HomepageSection::updateOrCreate(
                ['slug' => $section['slug']],
                $section
            );
        }

        // 4. WEBSITE MENUS
        $this->command?->info('Seeding Website Menus...');
        $menus = [
            ['title' => 'Beranda', 'slug' => 'beranda', 'url' => '/', 'icon' => 'home', 'display_order' => 1, 'visible' => true, 'open_in_new_tab' => false],
            ['title' => 'Layanan', 'slug' => 'layanan', 'url' => '#services', 'icon' => 'grid', 'display_order' => 2, 'visible' => true, 'open_in_new_tab' => false],
            ['title' => 'Fitur', 'slug' => 'fitur', 'url' => '#features', 'icon' => 'sparkles', 'display_order' => 3, 'visible' => true, 'open_in_new_tab' => false],
            ['title' => 'Tentang Kami', 'slug' => 'tentang', 'url' => '#about', 'icon' => 'info', 'display_order' => 4, 'visible' => true, 'open_in_new_tab' => false],
            ['title' => 'FAQ', 'slug' => 'faq', 'url' => '#faq', 'icon' => 'help-circle', 'display_order' => 5, 'visible' => true, 'open_in_new_tab' => false],
            ['title' => 'Kontak', 'slug' => 'kontak', 'url' => '#contact', 'icon' => 'phone', 'display_order' => 6, 'visible' => true, 'open_in_new_tab' => false],
        ];

        foreach ($menus as $menu) {
            WebsiteMenu::updateOrCreate(
                ['slug' => $menu['slug']],
                $menu
            );
        }

        // 5. STATIC PAGES
        $this->command?->info('Seeding Static Pages...');
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
            StaticPage::updateOrCreate(
                ['slug' => $page['slug']],
                $page
            );
        }

        // 6. FAQ
        $this->command?->info('Seeding FAQ list...');
        $faqs = [
            [
                'question' => 'Bagaimana cara mengisi saldo (top up) dompet GurkyNet?',
                'answer' => 'Anda dapat mengisi saldo melalui transfer bank virtual account (BCA, Mandiri, BRI, BNI), QRIS instan, atau melalui gerai Alfamart/Indomaret terdekat menggunakan sistem pembayaran otomatis Midtrans.',
                'order' => 1,
            ],
            [
                'question' => 'Berapa lama waktu proses transaksi produk digital di GurkyNet?',
                'answer' => 'Transaksi pulsa, paket data, dan token PLN diproses secara instan otomatis oleh server kami dalam hitungan 1-5 detik setelah pembayaran terkonfirmasi.',
                'order' => 2,
            ],
            [
                'question' => 'Bagaimana jika transaksi saya gagal atau salah nomor tujuan?',
                'answer' => 'Jika transaksi gagal diproses oleh sistem provider, saldo Anda akan otomatis direfund 100% kembali ke saldo dompet GurkyNet. Pastikan nomor tujuan selalu dicek kembali sebelum konfirmasi pembayaran.',
                'order' => 3,
            ],
            [
                'question' => 'Apakah GurkyNet menyediakan layanan bantuan Customer Support 24 jam?',
                'answer' => 'Ya, tim Customer Support kami siap membantu Anda 24 jam sehari, 7 hari seminggu melalui live chat WhatsApp dan sistem tiket bantuan di dalam dashboard.',
                'order' => 4,
            ],
        ];

        foreach ($faqs as $faq) {
            Faq::updateOrCreate(
                ['question' => $faq['question']],
                $faq
            );
        }

        // 7. BANNERS, PROMOTIONS, & VOUCHERS
        $this->command?->info('Seeding Banners, Promotions, and Vouchers...');
        $banners = [
            [
                'type' => 'banner',
                'title' => 'Flash Sale Spesial PPOB GurkyNet',
                'slug' => 'flash-sale-ppob',
                'description' => 'Dapatkan diskon potongan harga langsung hingga 50% untuk transaksi pulsa dan token listrik setiap hari!',
                'terms' => "1. Promo berlaku untuk transaksi pulsa dan token PLN.\n2. Satu kode hanya dapat digunakan sesuai ketentuan.\n3. GurkyNet berhak membatalkan transaksi yang menyalahi ketentuan.",
                'code' => 'FLASHSALE',
                'discount_amount' => 5000,
                'discount_type' => 'fixed',
                'image_url' => 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=1200&q=80',
                'redirect_url' => '/dashboard/pulsa',
                'cta_label' => 'Gunakan Promo',
                'starts_at' => now()->subDay(),
                'ends_at' => now()->addMonths(2),
                'priority' => 10,
                'sort_order' => 1,
                'is_active' => true,
                'image_media_id' => $mediaHero?->id,
            ],
            [
                'type' => 'banner',
                'title' => 'Cashback 20% Top Up Game Terpopuler',
                'slug' => 'cashback-topup-game',
                'description' => 'Top up diamond Mobile Legends dan Free Fire makin hemat dengan cashback saldo dompet instan.',
                'terms' => "1. Berlaku untuk produk game terpilih.\n2. Cashback dikreditkan ke saldo GurkyPay.\n3. Kuota terbatas setiap hari.",
                'code' => 'GAMEHEMAT',
                'discount_amount' => 20,
                'discount_type' => 'percentage',
                'image_url' => 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200&q=80',
                'redirect_url' => '/dashboard/game',
                'cta_label' => 'Gunakan Promo',
                'starts_at' => now()->subDay(),
                'ends_at' => now()->addMonths(2),
                'priority' => 5,
                'sort_order' => 2,
                'is_active' => true,
                'image_media_id' => $mediaHero?->id,
            ],
            [
                'type' => 'promotion',
                'title' => 'Diskon Tagihan Bulanan PLN & BPJS',
                'description' => 'Bayar semua tagihan rutin keluarga tepat waktu dengan biaya admin Rp 0 rupiah.',
                'code' => 'BEBASADMIN',
                'discount_amount' => 2500,
                'discount_type' => 'fixed',
                'min_transaction' => 50000,
                'quota' => 250,
                'used_count' => 14,
                'image_url' => 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=1200&q=80',
                'redirect_url' => '/promo/tagihan-bulanan',
                'is_active' => true,
            ],
            [
                'type' => 'voucher',
                'title' => 'Voucher Pengguna Baru GurkyNet',
                'description' => 'Klaim saldo bonus Rp 10.000 untuk transaksi pertama setelah verifikasi akun.',
                'code' => 'GURKYBARU',
                'discount_amount' => 10000,
                'discount_type' => 'fixed',
                'min_transaction' => 25000,
                'quota' => 1000,
                'used_count' => 128,
                'image_url' => 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1200&q=80',
                'redirect_url' => '/voucher/pengguna-baru',
                'is_active' => true,
            ],
            [
                'type' => 'voucher',
                'title' => 'Voucher Weekend Seru Top Up Game',
                'description' => 'Diskon 15% maksimal Rp 15.000 untuk top up Mobile Legends dan Free Fire setiap Sabtu-Minggu.',
                'code' => 'GURKYGAME',
                'discount_amount' => 15000,
                'discount_type' => 'percentage',
                'min_transaction' => 30000,
                'quota' => 300,
                'used_count' => 45,
                'image_url' => 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=1200&q=80',
                'redirect_url' => '/voucher/weekend-game',
                'is_active' => true,
            ],
        ];

        foreach ($banners as $b) {
            $banner = BannerPromotion::withTrashed()
                ->where('title', $b['title'])
                ->orWhere('code', $b['code'] ?? null)
                ->first();

            if ($banner) {
                if ($banner->trashed()) {
                    $banner->restore();
                }
                $banner->update($b);
            } else {
                BannerPromotion::create($b);
            }
        }

        // 8. NOTIFICATIONS & ANNOUNCEMENTS
        $this->command?->info('Seeding Notifications & Announcements...');
        $notifications = [
            [
                'title' => 'Peningkatan Sistem & Keamanan Server GurkyNet',
                'message' => 'Sistem pembayaran GurkyNet kini telah dioptimalkan dengan sertifikasi keamanan end-to-end terkini untuk menjamin kenyamanan transaksi Anda.',
                'type' => 'broadcast',
                'is_active' => true,
            ],
            [
                'title' => 'Jadwal Pemeliharaan Rutin Bank BCA & Mandiri',
                'message' => 'Layanan Virtual Account Bank BCA dan Mandiri beroperasi normal 24 jam. Segala transaksi otomatis terkonfirmasi dalam hitungan detik.',
                'type' => 'announcement',
                'is_active' => true,
            ],
            [
                'title' => 'Dukungan Metode Pembayaran QRIS Nasional',
                'message' => 'Sekarang Anda dapat melakukan isi ulang saldo dompet digital GurkyNet secara instan melalui QRIS semua bank dan e-wallet.',
                'type' => 'promo',
                'is_active' => true,
            ],
        ];

        foreach ($notifications as $n) {
            $notif = Notification::withTrashed()->where('title', $n['title'])->first();
            if ($notif) {
                if ($notif->trashed()) {
                    $notif->restore();
                }
                $notif->update($n);
            } else {
                Notification::create($n);
            }
        }

        // 9. PRODUCT CATEGORIES (stable slugs used by frontend filters; Digiflazz sync upserts more)
        $this->command?->info('Seeding Product Categories scaffolding...');
        $categories = [
            ['name' => 'Pulsa', 'slug' => 'pulsa', 'icon' => 'smartphone'],
            ['name' => 'Paket Data', 'slug' => 'data', 'icon' => 'wifi'],
            ['name' => 'Voucher Internet', 'slug' => 'voucher-internet', 'icon' => 'wifi'],
            ['name' => 'Paket SMS & Telepon', 'slug' => 'sms-telepon', 'icon' => 'message-square'],
            ['name' => 'Masa Aktif', 'slug' => 'masa-aktif', 'icon' => 'clock'],
            ['name' => 'Aktivasi Perdana', 'slug' => 'aktivasi-perdana', 'icon' => 'sim'],
            ['name' => 'eSIM', 'slug' => 'esim', 'icon' => 'sim'],
            ['name' => 'Token PLN', 'slug' => 'pln', 'icon' => 'zap'],
            ['name' => 'PLN Pascabayar', 'slug' => 'pln-pascabayar', 'icon' => 'zap'],
            ['name' => 'PDAM', 'slug' => 'pdam', 'icon' => 'droplet'],
            ['name' => 'BPJS Kesehatan', 'slug' => 'bpjs-kesehatan', 'icon' => 'heart'],
            ['name' => 'BPJS Ketenagakerjaan', 'slug' => 'bpjs-tk', 'icon' => 'briefcase'],
            ['name' => 'Internet Pascabayar', 'slug' => 'internet-pascabayar', 'icon' => 'wifi'],
            ['name' => 'TV Pascabayar', 'slug' => 'tv-pascabayar', 'icon' => 'tv'],
            ['name' => 'Gas Negara', 'slug' => 'gas', 'icon' => 'flame'],
            ['name' => 'PBB', 'slug' => 'pbb', 'icon' => 'home'],
            ['name' => 'SAMSAT', 'slug' => 'samsat', 'icon' => 'car'],
            ['name' => 'Multifinance', 'slug' => 'multifinance', 'icon' => 'landmark'],
            ['name' => 'Tagihan Lainnya', 'slug' => 'tagihan', 'icon' => 'receipt'],
            ['name' => 'Top Up Digital', 'slug' => 'topup-digital', 'icon' => 'credit-card'],
            ['name' => 'Top Up Digital', 'slug' => 'ewallet', 'icon' => 'credit-card'],
            ['name' => 'Game', 'slug' => 'game', 'icon' => 'gamepad-2'],
            ['name' => 'Voucher Digital', 'slug' => 'voucher-digital', 'icon' => 'gift'],
            ['name' => 'Voucher Digital', 'slug' => 'voucher', 'icon' => 'gift'],
            ['name' => 'Langganan Digital', 'slug' => 'langganan-digital', 'icon' => 'play'],
            ['name' => 'International Top Up', 'slug' => 'international', 'icon' => 'globe'],
            ['name' => 'Transfer Uang Bank', 'slug' => 'transfer', 'icon' => 'send'],
        ];

        foreach ($categories as $c) {
            $category = ProductCategory::withTrashed()->where('slug', $c['slug'])->first();
            if ($category) {
                if ($category->trashed()) {
                    $category->restore();
                }
                $category->update([
                    'name' => $c['name'],
                    'slug' => $c['slug'],
                    'icon' => $c['icon'],
                ]);
            } else {
                ProductCategory::create([
                    'name' => $c['name'],
                    'slug' => $c['slug'],
                    'icon' => $c['icon'],
                ]);
            }
        }

        // Master product catalog is Digiflazz-driven. Do NOT seed static demo products.
        // Run: php artisan digiflazz:sync
        $this->command?->info('Skipping static product/provider seed — catalog comes from Digiflazz sync (php artisan digiflazz:sync).');

        // 10. DEFAULT USERS & WALLETS (Idempotent & Conflict-Safe)
        $this->command?->info('Seeding Roles & Default Users...');
        $usersData = [
            [
                'email' => 'admin@gurkypay.com',
                'name' => 'Root System Master (Super Admin)',
                'phone_number' => '080000000000',
                'password' => Hash::make('$xngCc07om9itb'),
                'role' => \App\Enums\UserRole::SUPER_ADMIN,
                'transaction_pin' => Hash::make('123456'),
                'wallet_number' => '104288880000',
                'balance' => 999999999.00,
            ],
            [
                'email' => 'owner@gurkypay.com',
                'name' => 'Gurky Adipati (Owner)',
                'phone_number' => '081111111111',
                'password' => Hash::make('ExT7XW2oYJ$hKo'),
                'role' => \App\Enums\UserRole::OWNER,
                'transaction_pin' => Hash::make('123456'),
                'wallet_number' => '104288880001',
                'balance' => 99999999.00,
            ],
            [
                'email' => 'finance@gurkypay.com',
                'name' => 'Siti Nurhaliza (Finance)',
                'phone_number' => '082222222222',
                'password' => Hash::make('vHxBJb9mdK!3nz'),
                'role' => \App\Enums\UserRole::FINANCE,
                'transaction_pin' => Hash::make('123456'),
                'wallet_number' => '104288880002',
                'balance' => 50000000.00,
            ],
            [
                'email' => 'operations@gurkypay.com',
                'name' => 'Bambang Tri (Operations)',
                'phone_number' => '083333333333',
                'password' => Hash::make('SrJs%Lg42ba3d2'),
                'role' => \App\Enums\UserRole::OPERATIONS,
                'transaction_pin' => Hash::make('123456'),
                'wallet_number' => '104288880003',
                'balance' => 10000000.00,
            ],
            [
                'email' => 'marketing@gurkypay.com',
                'name' => 'Dewi Lestari (Marketing)',
                'phone_number' => '084444444444',
                'password' => Hash::make('PvkoN!XxRvjjD7'),
                'role' => \App\Enums\UserRole::MARKETING,
                'transaction_pin' => Hash::make('123456'),
                'wallet_number' => '104288880004',
                'balance' => 5000000.00,
            ],
            [
                'email' => 'cs@gurkypay.com',
                'name' => 'Anisa Rahma (Customer Support)',
                'phone_number' => '085555555555',
                'password' => Hash::make('BozHwVZQJ!8e2J'),
                'role' => \App\Enums\UserRole::CUSTOMER_SUPPORT,
                'transaction_pin' => Hash::make('123456'),
                'wallet_number' => '104288880005',
                'balance' => 2000000.00,
            ],
            [
                'email' => 'budi@gurkypay.com',
                'name' => 'Budi Santoso (Member / Customer)',
                'phone_number' => '081234567890',
                'password' => Hash::make('password123'),
                'role' => \App\Enums\UserRole::USER,
                'transaction_pin' => Hash::make('123456'),
                'wallet_number' => '104211111111',
                'balance' => 500000.00,
            ],
            [
                'email' => 'demo@gurkypay.com',
                'name' => 'Demo User GurkyPay',
                'phone_number' => '089999999999',
                'password' => Hash::make('demo123456'),
                'role' => \App\Enums\UserRole::USER,
                'transaction_pin' => Hash::make('123456'),
                'wallet_number' => '104299999999',
                'balance' => 1000000.00,
            ],
        ];

        foreach ($usersData as $u) {
            try {
                $user = User::withTrashed()->where('email', $u['email'])->first();

                if ($user) {
                    if ($user->trashed()) {
                        $user->restore();
                    }
                    $updateData = [
                        'name' => $u['name'],
                        'password' => $u['password'],
                        'role' => $u['role'],
                        'transaction_pin' => $u['transaction_pin'],
                    ];

                    $phoneConflict = User::withTrashed()
                        ->where('phone_number', $u['phone_number'])
                        ->where('id', '!=', $user->id)
                        ->exists();

                    if (!$phoneConflict) {
                        $updateData['phone_number'] = $u['phone_number'];
                    }

                    $user->update($updateData);
                } else {
                    $existingPhoneUser = User::withTrashed()->where('phone_number', $u['phone_number'])->first();
                    $phoneNumberToUse = $existingPhoneUser ? '08' . mt_rand(1000000000, 9999999999) : $u['phone_number'];

                    $user = User::create([
                        'email' => $u['email'],
                        'name' => $u['name'],
                        'phone_number' => $phoneNumberToUse,
                        'password' => $u['password'],
                        'role' => $u['role'],
                        'transaction_pin' => $u['transaction_pin'],
                    ]);
                }

                $wallet = Wallet::withTrashed()->where('user_id', $user->id)->first();
                if ($wallet) {
                    if ($wallet->trashed()) {
                        $wallet->restore();
                    }
                    $wallet->update([
                        'status' => 'active',
                    ]);
                } else {
                    $walletConflict = Wallet::withTrashed()->where('wallet_number', $u['wallet_number'])->exists();
                    $walletNumberToUse = $walletConflict ? '1042' . mt_rand(10000000, 99999999) : $u['wallet_number'];

                    Wallet::create([
                        'user_id' => $user->id,
                        'wallet_number' => $walletNumberToUse,
                        'balance' => $u['balance'],
                        'status' => 'active',
                    ]);
                }
            } catch (\Throwable $e) {
                $this->command?->warn("User {$u['email']} notice: " . $e->getMessage());
            }
        }

        // 11. SETTINGS & SYSTEM SETTINGS
        $this->command?->info('Seeding System Settings...');
        $defaultSettings = [
            'app_name' => 'GurkyNet',
            'app_logo' => '/assets/logo.png',
            'maintenance_mode' => 'false',
            'default_margin' => '1500',
            'digiflazz_username' => 'gurkynet_production',
            'midtrans_merchant_id' => 'M104283948',
        ];
        foreach ($defaultSettings as $k => $v) {
            Setting::updateOrCreate(['key' => $k], ['value' => $v]);
        }

        $defaultSystemSettings = [
            'app_name' => 'GurkyNet',
            'app_environment' => 'production',
            'app_debug' => 'false',
            'app_url' => config('app.url', 'https://api.gurkynet.my.id'),
            'payment_midtrans_server_key' => env('MIDTRANS_SERVER_KEY', ''),
            'payment_midtrans_client_key' => env('MIDTRANS_CLIENT_KEY', ''),
            'payment_midtrans_is_production' => env('MIDTRANS_IS_PRODUCTION', 'false'),
            'ppob_digiflazz_username' => env('DIGIFLAZZ_USERNAME', ''),
            'ppob_digiflazz_api_key' => env('DIGIFLAZZ_API_KEY', ''),
            'ppob_digiflazz_webhook_secret' => env('DIGIFLAZZ_SECRET', ''),
            'ppob_vip_display_name' => env('VIP_PRODUCT_PROVIDER_NAME', 'VipPulsa'),
            'ppob_vip_enable' => env('VIP_PRODUCT_PROVIDER_ENABLED', 'false'),
            'ppob_vip_merchant_id' => env('VIP_MERCHANT_ID', ''),
            'ppob_vip_api_key' => env('VIP_API_KEY', ''),
            'ppob_vip_signature' => env('VIP_SIGNATURE', ''),
            'email_smtp_host' => env('MAIL_HOST', 'smtp.mailgun.org'),
            'email_smtp_port' => env('MAIL_PORT', '587'),
            'email_smtp_username' => env('MAIL_USERNAME', ''),
            'email_smtp_password' => env('MAIL_PASSWORD', ''),
            'email_smtp_encryption' => env('MAIL_ENCRYPTION', 'tls'),
            'email_from_address' => env('MAIL_FROM_ADDRESS', 'noreply@gurkynet.com'),
            'email_from_name' => env('MAIL_FROM_NAME', 'GurkyNet'),
        ];
        foreach ($defaultSystemSettings as $key => $value) {
            SystemSetting::updateOrCreate(['key' => $key], ['value' => $value]);
        }

        // 12. RBAC — ROLES, PERMISSIONS & BACKFILL (Sprint 2 — Authentication & RBAC)
        // SRS Bagian 7.2 & Bagian 5 (Matriks Hak Akses). Additive & idempotent —
        // tidak menyentuh/menghapus data seeding di atas. Urutan wajib: roles →
        // permissions → role_permissions → backfill user (backfill butuh roles).
        $this->command?->info('Seeding RBAC roles, permissions, role-permission matrix & user backfill...');
        $this->call([
            RoleSeeder::class,
            PermissionSeeder::class,
            RolePermissionSeeder::class,
            UserRbacBackfillSeeder::class,
        ]);

        $this->command?->info('Database seeding completed successfully!');
    }
}
