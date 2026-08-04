<?php

namespace App\Repositories\Eloquent;

use App\Models\StaticPage;
use App\Repositories\Contracts\StaticPageRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Pagination\LengthAwarePaginator;

class StaticPageRepository implements StaticPageRepositoryInterface
{
    public function getPaginated(array $filters = []): LengthAwarePaginator
    {
        $this->ensureDefaults();

        $query = StaticPage::query();

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['keyword'])) {
            $query->where(function($q) use ($filters) {
                $q->where('title', 'like', '%' . $filters['keyword'] . '%')
                  ->orWhere('content', 'like', '%' . $filters['keyword'] . '%');
            });
        }

        $perPage = $filters['per_page'] ?? 15;
        return $query->latest('id')->paginate($perPage);
    }

    public function all(): Collection
    {
        $this->ensureDefaults();

        return StaticPage::all();
    }

    public function findById(int $id): ?StaticPage
    {
        return StaticPage::find($id);
    }

    public function findBySlug(string $slug): ?StaticPage
    {
        return StaticPage::where('slug', $slug)->first();
    }

    public function create(array $data): StaticPage
    {
        return StaticPage::create($data);
    }

    public function update(int $id, array $data): StaticPage
    {
        $page = StaticPage::findOrFail($id);
        $page->update($data);
        return $page;
    }

    public function delete(int $id): bool
    {
        $page = StaticPage::find($id);
        if ($page) {
            return (bool) $page->delete();
        }
        return false;
    }

    public function ensureDefaults(): void
    {
        if (StaticPage::count() === 0) {
            $staticPages = [
                [
                    'title' => 'Tentang Kami',
                    'slug' => 'about-us',
                    'seo_title' => 'Tentang GurkyNet - Platform PPOB & Top Up Game Terpercaya',
                    'seo_description' => 'Pelajari lebih lanjut tentang GurkyNet, visi, misi, dan komitmen kami dalam memberikan layanan transaksi digital terbaik di Indonesia.',
                    'content' => '<h3>Selamat Datang di GurkyNet</h3><p>GurkyNet adalah platform agregator layanan PPOB (Payment Point Online Bank) dan produk digital terdepan di Indonesia. Kami hadir untuk memudahkan masyarakat dan pelaku UMKM dalam melakukan transaksi kebutuhan digital harian seperti pulsa seluler, paket data internet, token PLN, voucher game, hingga pembayaran tagihan bulanan BPJS, PDAM, dan multifinance secara instan, aman, dan dengan harga termurah.</p>',
                    'status' => 'published',
                    'published_at' => now(),
                ],
                [
                    'title' => 'Kebijakan Privasi',
                    'slug' => 'privacy-policy',
                    'seo_title' => 'Kebijakan Privasi - GurkyNet',
                    'seo_description' => 'Informasi mengenai bagaimana GurkyNet mengumpulkan, menggunakan, dan melindungi data pribadi Anda.',
                    'content' => '<h3>Kebijakan Privasi GurkyNet</h3><p>PT Gurky Solusi Digital ("GurkyNet") berkomitmen penuh untuk melindungi privasi dan keamanan data pribadi setiap pengguna layanan kami. Kebijakan Privasi ini menjelaskan bagaimana data Anda dikumpulkan, disimpan, diproses, dan dilindungi saat menggunakan situs web dan aplikasi GurkyNet.</p>',
                    'status' => 'published',
                    'published_at' => now(),
                ],
                [
                    'title' => 'Syarat dan Ketentuan',
                    'slug' => 'terms-conditions',
                    'seo_title' => 'Syarat dan Ketentuan Layanan - GurkyNet',
                    'seo_description' => 'Syarat dan ketentuan umum penggunaan aplikasi dan situs web GurkyNet.',
                    'content' => '<h3>Syarat & Ketentuan Layanan GurkyNet</h3><p>Dengan mendaftar, mengakses, atau menggunakan layanan GurkyNet, Anda menyatakan bahwa Anda telah membaca, memahami, dan menyetujui untuk terikat oleh Syarat dan Ketentuan ini.</p>',
                    'status' => 'published',
                    'published_at' => now(),
                ],
                [
                    'title' => 'Kebijakan Pengembalian Dana (Refund)',
                    'slug' => 'refund-policy',
                    'seo_title' => 'Kebijakan Refund dan Pengembalian Dana - GurkyNet',
                    'seo_description' => 'Panduan lengkap mengenai kebijakan dan prosedur pengembalian dana transaksi di GurkyNet.',
                    'content' => '<h3>Kebijakan Pengembalian Dana (Refund)</h3><p>Kepuasan dan kenyamanan pengguna adalah prioritas utama GurkyNet. Kami menjamin perlindungan saldo untuk seluruh transaksi yang dilakukan melalui platform kami.</p>',
                    'status' => 'published',
                    'published_at' => now(),
                ],
            ];

            foreach ($staticPages as $page) {
                StaticPage::firstOrCreate(['slug' => $page['slug']], $page);
            }
        }
    }
}
