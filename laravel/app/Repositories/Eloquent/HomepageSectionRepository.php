<?php

namespace App\Repositories\Eloquent;

use App\Models\HomepageSection;
use App\Repositories\Contracts\HomepageSectionRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Pagination\LengthAwarePaginator;

class HomepageSectionRepository implements HomepageSectionRepositoryInterface
{
    private const WITH = ['heroBackgroundMedia', 'heroIllustrationMedia', 'heroMobileImageMedia'];

    public function getPaginated(array $filters = []): LengthAwarePaginator
    {
        $this->ensureDefaults();

        $query = HomepageSection::with(self::WITH);

        if (isset($filters['visible'])) {
            $query->where('visible', filter_var($filters['visible'], FILTER_VALIDATE_BOOLEAN));
        }

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['component_type'])) {
            $query->where('component_type', $filters['component_type']);
        }

        if (!empty($filters['keyword'])) {
            $query->where('title', 'like', '%' . $filters['keyword'] . '%');
        }

        $perPage = $filters['per_page'] ?? 15;
        return $query->orderBy('display_order', 'asc')->paginate($perPage);
    }

    public function all(): Collection
    {
        $this->ensureDefaults();

        return HomepageSection::with(self::WITH)->orderBy('display_order', 'asc')->get();
    }

    public function findById(int $id): ?HomepageSection
    {
        return HomepageSection::with(self::WITH)->find($id);
    }

    public function findBySlug(string $slug): ?HomepageSection
    {
        return HomepageSection::with(self::WITH)->where('slug', $slug)->first();
    }

    public function create(array $data): HomepageSection
    {
        $section = HomepageSection::create($data);
        return $section->load(self::WITH);
    }

    public function update(int $id, array $data): HomepageSection
    {
        $section = HomepageSection::findOrFail($id);
        $section->update($data);
        return $section->load(self::WITH);
    }

    public function delete(int $id): bool
    {
        $section = HomepageSection::find($id);
        if ($section) {
            return (bool) $section->delete();
        }
        return false;
    }

    public function ensureDefaults(): void
    {
        if (HomepageSection::count() === 0) {
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
                    'animation' => 'fade',
                ],
                [
                    'title' => 'Statistik Platform',
                    'slug' => 'statistik-platform',
                    'component_type' => 'statistics',
                    'display_order' => 8,
                    'visible' => true,
                    'status' => 'active',
                    'subtitle' => 'Dipercaya jutaan transaksi',
                    'description' => 'Angka yang terus bertumbuh bersama komunitas reseller dan pengguna akhir.',
                    'animation' => 'slide_up',
                    'content_items' => [
                        ['title' => 'Transaksi', 'value' => '1M+', 'description' => 'Transaksi berhasil diproses'],
                        ['title' => 'Uptime', 'value' => '99.9%', 'description' => 'Ketersediaan layanan'],
                        ['title' => 'Mitra', 'value' => '50+', 'description' => 'Brand & operator'],
                        ['title' => 'Support', 'value' => '24/7', 'description' => 'Bantuan pelanggan'],
                    ],
                ],
                [
                    'title' => 'Partner & Operator',
                    'slug' => 'partner-operator',
                    'component_type' => 'partners',
                    'display_order' => 9,
                    'visible' => true,
                    'status' => 'active',
                    'subtitle' => 'Terintegrasi dengan penyedia terpercaya',
                    'description' => 'Jaringan partner digital untuk memastikan produk selalu tersedia.',
                    'animation' => 'fade',
                    'content_items' => [
                        ['title' => 'Digiflazz'],
                        ['title' => 'VIPayment'],
                        ['title' => 'Telkomsel'],
                        ['title' => 'XL'],
                        ['title' => 'Indosat'],
                        ['title' => 'PLN'],
                    ],
                ],
                [
                    'title' => 'Siap Mulai Transaksi?',
                    'slug' => 'cta-utama',
                    'component_type' => 'cta',
                    'display_order' => 10,
                    'visible' => true,
                    'status' => 'active',
                    'subtitle' => 'Gabung sekarang',
                    'description' => 'Daftar gratis dan nikmati katalog PPOB lengkap dengan harga kompetitif.',
                    'button_label' => 'Daftar Sekarang',
                    'button_url' => '/register',
                    'animation' => 'scale',
                ],
            ];

            foreach ($sections as $section) {
                HomepageSection::firstOrCreate(['slug' => $section['slug']], $section);
            }
        }
    }
}
