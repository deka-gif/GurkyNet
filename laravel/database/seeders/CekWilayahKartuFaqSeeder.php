<?php

namespace Database\Seeders;

use App\Models\Faq;
use App\Support\CekWilayahKartuFaq;
use Illuminate\Database\Seeder;

/**
 * Seeds 6 FAQ rows for mobile /help/cek-zona (CS-editable via Knowledge Base).
 * No USSD dial codes — always point to official app for latest dial codes.
 */
class CekWilayahKartuFaqSeeder extends Seeder
{
    public function run(): void
    {
        $articles = [
            'telkomsel' => [
                'order' => 100,
                'answer' => implode("\n", [
                    '1. Buka aplikasi MyTelkomsel, login dengan nomor Telkomsel.',
                    '2. Masuk ke menu Info Kuota.',
                    '3. Lihat wilayah yang tertera di detail paket aktif.',
                    '',
                    'Alternatif: cek kode dial resmi di aplikasi MyTelkomsel (kode dapat berubah sewaktu-waktu).',
                ]),
            ],
            'indosat' => [
                'order' => 101,
                'answer' => implode("\n", [
                    '1. Buka aplikasi myIM3.',
                    '2. Masuk ke menu informasi paket/kuota aktif.',
                    '3. Lihat wilayah yang tertera.',
                    '',
                    'Alternatif: cek kode dial resmi di aplikasi myIM3 (kode dapat berubah sewaktu-waktu).',
                ]),
            ],
            'tri' => [
                'order' => 102,
                'answer' => implode("\n", [
                    '1. Buka aplikasi Bima+ Tri.',
                    '2. Masuk ke menu paket aktif.',
                    '3. Lihat wilayah yang tertera.',
                    '',
                    'Alternatif: cek kode dial resmi di aplikasi Bima+ (kode dapat berubah sewaktu-waktu).',
                ]),
            ],
            'axis' => [
                'order' => 103,
                'answer' => implode("\n", [
                    '1. Buka aplikasi AXISnet.',
                    '2. Masuk ke menu "Cek Paket & Kuota" — aplikasi ini menampilkan kota registrasi nomor secara langsung.',
                    '3. Catat info kuota/wilayah yang tampil (Axis tidak memakai pemilihan zona manual saat beli).',
                    '',
                    'Alternatif: cek kode dial resmi di aplikasi AXISnet (kode dapat berubah sewaktu-waktu).',
                ]),
            ],
            'xl' => [
                'order' => 104,
                'answer' => implode("\n", [
                    '1. Buka aplikasi myXL.',
                    '2. Masuk ke menu Info Kuota.',
                    '3. Lihat wilayah yang tertera (East/West/Central).',
                    '',
                    'Alternatif: cek kode dial resmi di aplikasi myXL (kode dapat berubah sewaktu-waktu).',
                ]),
            ],
            'smartfren' => [
                'order' => 105,
                'answer' => implode("\n", [
                    '1. Buka aplikasi MySmartfren.',
                    '2. Masuk ke menu info paket aktif, atau hubungi Customer Service (zona hanya berlaku untuk sebagian kecil produk area Jawa Timur).',
                    '3. Konfirmasi apakah nomor/produk Anda memakai zona area (Tapal Kuda, Mandiri, Mapan) jika relevan.',
                    '',
                    'Alternatif: cek kode dial resmi di aplikasi MySmartfren (kode dapat berubah sewaktu-waktu).',
                ]),
            ],
        ];

        foreach ($articles as $slug => $data) {
            $question = CekWilayahKartuFaq::titleFor($slug);
            Faq::updateOrCreate(
                ['question' => $question],
                [
                    'answer' => $data['answer'],
                    'order' => $data['order'],
                ]
            );
        }
    }
}
