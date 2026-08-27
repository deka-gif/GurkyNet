<?php

namespace App\Services\Legal;

use App\Models\LegalDocument;

/**
 * Sprint 18 — SRS Bagian 27–29 content (literal themes only; no invented clauses).
 * Documents remain pending_legal_review until lawyer approval — not legally binding.
 */
class SrsLegalContent
{
    public static function html(string $type): string
    {
        return match ($type) {
            LegalDocument::TYPE_PRIVACY => self::privacy(),
            LegalDocument::TYPE_TERMS => self::terms(),
            LegalDocument::TYPE_REFUND => self::refund(),
            default => '<p>Dokumen tidak dikenal.</p>',
        };
    }

    protected static function banner(): string
    {
        return '<p><em>Status: draft infrastruktur CMS — belum mengikat secara hukum hingga review konsultan hukum (SRS Bagian 27 catatan). Versi konten mengikuti SRS GurkyNet v2.2.</em></p>';
    }

    protected static function privacy(): string
    {
        return self::banner()
            .'<h2>Kebijakan Privasi</h2>'
            .'<p>GurkyNet mengelola layanan PPOB. Kebijakan ini menjelaskan pengumpulan, penggunaan, penyimpanan, pembagian, dan perlindungan data pribadi. Dengan membuat akun atau menggunakan Layanan, Anda menyetujui praktik ini (SRS 27.1).</p>'
            .'<h3>27.2 Data yang Kami Kumpulkan</h3>'
            .'<ul><li>Identitas (nama, KTP, selfie untuk KYC Tier 2)</li><li>Kontak (HP, email)</li><li>Keuangan (transaksi, saldo, rekening withdraw)</li><li>Teknis (IP, perangkat, log login)</li><li>Komunikasi (chat/tiket)</li><li>Lokasi perkiraan berbasis IP (opsional)</li></ul>'
            .'<h3>27.3–27.6 Tujuan, Dasar, Pihak Ketiga, Keamanan</h3>'
            .'<p>Data digunakan untuk transaksi, KYC, notifikasi, fraud detection, kewajiban hukum, dan peningkatan layanan. Dasar: persetujuan, kontrak, kewajiban hukum (UU PDP), kepentingan sah keamanan. Kami tidak menjual data. Dibagikan terbatas ke H2H (tanpa KTP), payment gateway, notifikasi, dan otoritas bila diwajibkan. Keamanan: hashing sandi, TLS, 2FA staf, RBAC, audit log.</p>'
            .'<h3>27.7 Retensi</h3>'
            .'<ul><li>Transaksi keuangan: minimal 10 tahun</li><li>KYC: selama akun aktif + 5 tahun setelah ditutup</li><li>Webhook mentah: minimal 90 hari</li><li>Chat/tiket: minimal 2 tahun sejak ditutup</li><li>Log login/IP: minimal 1 tahun</li></ul>'
            .'<h3>27.8–27.11 Hak, Cookie, Perubahan, Kontak</h3>'
            .'<p>Hak akses/koreksi/hapus (dengan pengecualian retensi hukum), tarik persetujuan, keberatan — via Akun Saya atau CS. Cookie untuk sesi dan analitik agregat. Perubahan material diberitahukan minimal 7 hari sebelumnya. Kontak melalui Bantuan/Live Chat.</p>';
    }

    protected static function terms(): string
    {
        return self::banner()
            .'<h2>Syarat dan Ketentuan</h2>'
            .'<p>Dengan mendaftar, mengakses, atau menggunakan Layanan, Anda menyetujui S&amp;K ini beserta Kebijakan Privasi dan Kebijakan Pengembalian Dana (SRS 28.1).</p>'
            .'<h3>28.2–28.5 Kelayakan, Akun, Saldo, Transaksi</h3>'
            .'<p>Usia minimal 17 tahun atau telah menikah; data benar; satu individu satu akun aktif kecuali izin tertulis. Pengguna bertanggung jawab atas sandi/OTP. Saldo untuk transaksi di Layanan; harga berlaku saat konfirmasi; kesalahan nomor tujuan menjadi tanggung jawab Pengguna.</p>'
            .'<h3>28.6 Withdraw</h3>'
            .'<p>Hanya Agen dengan KYC Tier 2; rekening atas nama terverifikasi; waktu proses mengikuti SLA Bagian 23.</p>'
            .'<h3>SLA Ringkas (SRS Bagian 23)</h3>'
            .'<ul>'
            .'<li>Respons pertama Live Chat CS (jam operasional): maksimal 5 menit</li>'
            .'<li>Tiket teknis ringan: maksimal 1×24 jam</li>'
            .'<li>Tiket dana/saldo setelah eskalasi Finance: maksimal 2×24 jam</li>'
            .'<li>Deposit manual: maksimal 30 menit jam kerja; maksimal 3 jam di luar jam kerja</li>'
            .'<li>Withdraw normal: maksimal 1×24 jam kerja; nominal besar/Owner: maksimal 2×24 jam kerja</li>'
            .'<li>Uptime bulanan target: minimal 99,5%</li>'
            .'</ul>'
            .'<h3>28.7–28.11 Larangan, Biaya, Tanggung Jawab, Perubahan, Hukum</h3>'
            .'<p>Dilarang aktivitas ilegal, peretasan, bot tanpa izin, identitas palsu, penyalahgunaan referral. Biaya admin ditampilkan transparan. Batasan tanggung jawab untuk gangguan pihak ketiga; refund sesuai kebijakan. Perubahan material minimal 7 hari pemberitahuan. Hukum RI; sengketa melalui CS lalu mekanisme hukum berlaku.</p>';
    }

    protected static function refund(): string
    {
        return self::banner()
            .'<h2>Kebijakan Pengembalian Dana</h2>'
            .'<p>Refund untuk kegagalan sistem/supplier/pembayaran — bukan kesalahan input Pengguna (SRS 29.1).</p>'
            .'<h3>29.2 Kategori &amp; Waktu</h3>'
            .'<ul>'
            .'<li><strong>Refund Otomatis Instan</strong> — status FAILED terkonfirmasi (Bagian 14.5 / FR-DIFF-09): otomatis, beberapa detik hingga maksimal 5 menit.</li>'
            .'<li><strong>Investigasi CS</strong> — saldo terpotong, sistem sukses, produk tidak diterima: komplain CS → eskalasi Ops/Finance; maksimal 2×24 jam kerja.</li>'
            .'<li><strong>Deposit ditolak</strong> — dana tidak masuk saldo; notifikasi maksimal 3 jam.</li>'
            .'<li><strong>Withdraw ditolak</strong> — hold dikembalikan otomatis; maksimal 1×24 jam kerja sejak penolakan.</li>'
            .'</ul>'
            .'<h3>29.3–29.4 Bentuk &amp; Pengecualian</h3>'
            .'<p>Pada prinsipnya dikredit ke Saldo Layanan. Tidak memenuhi syarat: salah nomor tujuan yang sukses diproses; pembatalan sepihak setelah diproses; penyalahgunaan akun karena kelalaian; permintaan &gt;30 hari kecuali indikasi kegagalan sistem dari rekonsiliasi.</p>'
            .'<h3>29.5–29.7 Proses</h3>'
            .'<p>Ajukan via Bantuan/Live Chat/Tiket; pantau status; keputusan tercatat. Perubahan kebijakan diinformasikan minimal 7 hari sebelumnya.</p>'
            .'<p><em>Konsistensi mesin: FAILED → auto refund; SUCCESS complaint → hanya jalur REFUNDED (bukan SUCCESS→FAILED).</em></p>';
    }
}
