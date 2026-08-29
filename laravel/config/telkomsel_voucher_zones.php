<?php

/**
 * Reference: Telkomsel Voucher Internet zone_label -> list of kabupaten/kota.
 * Used ONLY as a "search my city" convenience in the zona picker — the picker's
 * authoritative list is always the real zone_label values present in the catalog
 * (from products.zone_label), never this file. A city missing here just means the
 * search box won't auto-suggest for it; the user can still pick the zona by name
 * directly. Keys MUST match products.zone_label exactly (case-sensitive).
 *
 * Jawa-related labels (Jabodetabek, Jawa Barat, Jawa Tengah - DIY, Jawa Timur,
 * Sukabumi Bogor Banten, Jawa Lombok) are DELIBERATELY OMITTED — the source data
 * available was not granular enough to split them by kabupaten/kota without
 * guessing, and a wrong guess there is worse than no search assist. Owner may
 * supply a more detailed Jawa breakdown later.
 */

return [

    // ── Sumatera Utara ──────────────────────────────────────────────
    'Sumatera Utara Zona 1' => [
        'Aceh Barat', 'Aceh Barat Daya', 'Aceh Besar', 'Aceh Jaya', 'Aceh Selatan',
        'Aceh Tamiang', 'Aceh Tengah', 'Aceh Timur', 'Aceh Utara', 'Asahan',
        'Batu Bara', 'Bener Meriah', 'Bireuen', 'Dairi', 'Deli Serdang',
        'Humbang Hasundutan', 'Karo', 'Kota Banda Aceh', 'Kota Binjai', 'Kota Langsa',
        'Kota Lhokseumawe', 'Kota Medan', 'Kota Padangsidimpuan', 'Kota Pematang Siantar',
        'Kota Sabang', 'Kota Sibolga', 'Kota Subulussalam', 'Kota Tanjung Balai',
        'Kota Tebing Tinggi', 'Labuhan Batu', 'Labuhan Batu Selatan', 'Labuhan Batu Utara',
        'Langkat', 'Mandailing Natal', 'Nagan Raya', 'Padang Lawas', 'Padang Lawas Utara',
        'Pakpak Bharat', 'Pidie', 'Pidie Jaya', 'Samosir', 'Serdang Bedagai',
        'Simalungun', 'Tapanuli Selatan', 'Tapanuli Tengah', 'Tapanuli Utara', 'Toba Samosir',
    ],
    'Sumatera Utara Zona 2' => ['Aceh Singkil', 'Simeulue'],
    'Sumatera Utara Zona 3' => [
        'Aceh Tenggara', 'Gayo Lues', 'Gunungsitoli', 'Nias', 'Nias Barat',
        'Nias Selatan', 'Nias Utara',
    ],
    'Sumatera Utara Zona 3 Baru' => [
        'Aceh Besar', 'Aceh Tamiang', 'Aceh Tenggara', 'Aceh Timur', 'Asahan',
        'Batu Bara', 'Dairi', 'Deli Serdang', 'Humbang Hasundutan', 'Karo',
        'Kota Banda Aceh', 'Kota Binjai', 'Kota Langsa', 'Kota Medan',
        'Kota Padangsidimpuan', 'Kota Pematang Siantar', 'Kota Sibolga',
        'Kota Tanjung Balai', 'Kota Tebing Tinggi', 'Labuhan Batu',
        'Labuhan Batu Selatan', 'Labuhan Batu Utara', 'Langkat', 'Mandailing Natal',
        'Padang Lawas', 'Padang Lawas Utara', 'Pakpak Bharat', 'Samosir',
        'Serdang Bedagai', 'Simalungun', 'Tapanuli Selatan', 'Tapanuli Tengah',
        'Tapanuli Utara', 'Toba Samosir',
    ],

    // ── Sumatera Tengah ──────────────────────────────────────────────
    'Sumatera Tengah Zona 1' => [
        'Agam', 'Bintan', 'Karimun', 'Kota Batam', 'Kota Bukit Tinggi', 'Kota Padang',
        'Kota Padang Panjang', 'Kota Pariaman', 'Kota Payakumbuh', 'Kota Sawah Lunto',
        'Kota Solok', 'Kota Tanjung Pinang', 'Lima Puluh Kota', 'Padang Pariaman',
        'Solok', 'Tanah Datar', 'Kota Dumai', 'Bengkalis', 'Kampar', 'Kota Pekanbaru',
    ],
    'Sumatera Tengah Zona 2' => [
        'Dharmasraya', 'Indragiri Hilir', 'Indragiri Hulu', 'Kepulauan Anambas',
        'Kepulauan Meranti', 'Kuantan Singingi', 'Lingga', 'Natuna', 'Pasaman',
        'Pasaman Barat', 'Pelalawan', 'Pesisir Selatan', 'Rokan Hilir', 'Rokan Hulu',
        'Siak', 'Sijunjung', 'Solok Selatan',
    ],
    'Sumatera Tengah Zona 3' => ['Kepulauan Mentawai'],
    'Sumatera Tengah Zona 3 Baru' => [
        'Agam', 'Bengkalis', 'Bintan', 'Kampar', 'Kota Batam', 'Kota Bukit Tinggi',
        'Kota Dumai', 'Kota Padang', 'Kota Padang Panjang', 'Kota Pariaman',
        'Kota Payakumbuh', 'Kota Pekanbaru', 'Kota Solok', 'Kota Tanjung Pinang',
        'Lima Puluh Kota', 'Padang Pariaman', 'Pesisir Selatan', 'Rokan Hilir',
        'Siak', 'Solok', 'Tanah Datar',
    ],

    // ── Sumatera Selatan ─────────────────────────────────────────────
    'Sumatera Selatan Zona 1' => [
        'Bangka', 'Bangka Barat', 'Bangka Selatan', 'Bangka Tengah', 'Banyu Asin',
        'Batang Hari', 'Belitung', 'Belitung Timur', 'Bengkulu Tengah', 'Bungo',
        'Empat Lawang', 'Kepahiang', 'Kota Bandar Lampung', 'Kota Bengkulu',
        'Kota Jambi', 'Kota Metro', 'Kota Pagar Alam', 'Kota Palembang',
        'Kota Pangkal Pinang', 'Kota Prabumulih', 'Lahat', 'Lampung Barat',
        'Lampung Selatan', 'Lampung Tengah', 'Lampung Timur', 'Lampung Utara',
        'Mesuji', 'Muara Enim', 'Muaro Jambi', 'Musi Banyuasin', 'Ogan Ilir',
        'Ogan Komering Ilir', 'Ogan Komering Ulu', 'Ogan Komering Ulu Selatan',
        'Ogan Komering Ulu Timur', 'Penukal Abab Lematang Ilir', 'Pesawaran',
        'Pesisir Barat', 'Pringsewu', 'Sarolangun', 'Seluma', 'Tanggamus',
        'Tanjung Jabung Barat', 'Tanjung Jabung Timur', 'Tebo', 'Tulang Bawang Barat',
        'Tulangbawang', 'Way Kanan', 'Bengkulu Selatan', 'Kaur', 'Musi Rawas',
        'Musi Rawas Utara', 'Kota Lubuklinggau', 'Rejang Lebong',
    ],
    'Sumatera Selatan Zona 2' => [
        'Bengkulu Utara', 'Kerinci', 'Kota Sungai Penuh', 'Lebong', 'Merangin', 'Mukomuko',
    ],
    'Sumatera Selatan Zona 3 Baru' => [
        'Bangka', 'Bangka Barat', 'Bangka Selatan', 'Bangka Tengah', 'Banyu Asin',
        'Batang Hari', 'Belitung', 'Belitung Timur', 'Bengkulu Selatan', 'Bengkulu Tengah',
        'Empat Lawang', 'Kaur', 'Kepahiang', 'Kota Bandar Lampung', 'Kota Bengkulu',
        'Kota Jambi', 'Kota Lubuklinggau', 'Kota Metro', 'Kota Pagar Alam',
        'Kota Palembang', 'Kota Pangkal Pinang', 'Kota Prabumulih', 'Lahat',
        'Lampung Barat', 'Lampung Selatan', 'Lampung Tengah', 'Lampung Timur',
        'Lampung Utara', 'Lebong', 'Muara Enim', 'Muaro Jambi', 'Musi Banyuasin',
        'Musi Rawas', 'Musi Rawas Utara', 'Ogan Ilir', 'Ogan Komering Ilir',
        'Ogan Komering Ulu', 'Ogan Komering Ulu Selatan', 'Ogan Komering Ulu Timur',
        'Pesawaran', 'Pesisir Barat', 'Pringsewu', 'Rejang Lebong', 'Sarolangun',
        'Seluma', 'Tanggamus', 'Tanjung Jabung Barat', 'Tanjung Jabung Timur', 'Tebo',
        'Tulang Bawang Barat', 'Tulangbawang', 'Way Kanan',
    ],

    // ── Bali - Nusa Tenggara ─────────────────────────────────────────
    'Bali - Nusa Tenggara Zona 1' => [
        'Badung', 'Bangli', 'Buleleng', 'Gianyar', 'Jembrana', 'Karang Asem',
        'Klungkung', 'Kota Denpasar', 'Kota Mataram', 'Lombok Barat', 'Lombok Tengah',
        'Lombok Timur', 'Lombok Utara', 'Sumbawa Barat', 'Tabanan',
    ],
    'Bali - Nusa Tenggara Zona 2' => [
        'Alor', 'Belu', 'Bima', 'Dompu', 'Ende', 'Flores Timur', 'Kota Bima',
        'Kota Kupang', 'Kupang', 'Lembata', 'Malaka', 'Manggarai', 'Manggarai Barat',
        'Manggarai Timur', 'Nagekeo', 'Ngada', 'Rote Ndao', 'Sabu Raijua', 'Sikka',
        'Sumba Barat', 'Sumba Barat Daya', 'Sumba Tengah', 'Sumba Timur', 'Sumbawa',
        'Timor Tengah Selatan', 'Timor Tengah Utara',
    ],
    'Bali - Nusa Tenggara Zona 2 Baru' => [
        'Alor', 'Belu', 'Bima', 'Dompu', 'Ende', 'Flores Timur', 'Kota Bima',
        'Kota Kupang', 'Kupang', 'Lembata', 'Malaka', 'Manggarai', 'Manggarai Barat',
        'Manggarai Timur', 'Nagekeo', 'Ngada', 'Rote Ndao', 'Sabu Raijua', 'Sikka',
        'Sumba Barat', 'Sumba Barat Daya', 'Sumba Tengah', 'Sumba Timur', 'Sumbawa',
        'Sumbawa Barat', 'Timor Tengah Selatan', 'Timor Tengah Utara',
    ],
    'Bali - Nusa Tenggara Zona 3 Baru' => [
        'Badung', 'Bangli', 'Buleleng', 'Gianyar', 'Jembrana', 'Karang Asem',
        'Klungkung', 'Kota Denpasar', 'Tabanan',
    ],
    'Bali - Nusa Tenggara Zona 4 Baru' => [
        'Kota Mataram', 'Lombok Barat', 'Lombok Tengah', 'Lombok Timur', 'Lombok Utara',
    ],

    // ── Kalimantan ───────────────────────────────────────────────────
    'Kalimantan Zona 1' => [
        'Balangan', 'Banjar', 'Barito Kuala', 'Bengkayang', 'Hulu Sungai Selatan',
        'Hulu Sungai Tengah', 'Hulu Sungai Utara', 'Kapuas Hulu', 'Katingan',
        'Kayong Utara', 'Kota Balikpapan', 'Kota Banjar Baru', 'Kota Banjarmasin',
        'Kota Palangkaraya', 'Kota Pontianak', 'Kota Singkawang', 'Kota Waringin Barat',
        'Kota Waringin Timur', 'Kubu Raya', 'Landak', 'Mempawah', 'Penajam Paser Utara',
        'Sambas', 'Sanggau', 'Sekadau', 'Seruyan', 'Sintang', 'Tabalong', 'Tanah Laut',
        'Tapin', 'Kota Baru', 'Kota Samarinda', 'Melawi', 'Paser', 'Tanah Bumbu',
        'Pulang Pisau',
    ],
    'Kalimantan Zona 2' => [
        'Barito Timur', 'Barito Utara', 'Kapuas', 'Ketapang', 'Kota Bontang',
        'Kutai Kartanegara', 'Kutai Timur', 'Lamandau', 'Murung Raya', 'Sukamara',
        'Barito Selatan', 'Bulungan', 'Gunung Mas', 'Tana Tidung',
    ],
    'Kalimantan Zona 3' => [
        'Berau', 'Kota Tarakan', 'Kutai Barat', 'Mahakam Ulu', 'Malinau', 'Nunukan',
    ],
    'Kalimantan Zona 3 Varian Baru' => [
        'Banjar', 'Barito Kuala', 'Bengkayang', 'Hulu Sungai Selatan', 'Hulu Sungai Tengah',
        'Hulu Sungai Utara', 'Kota Balikpapan', 'Kota Banjar Baru', 'Kota Banjarmasin',
        'Kota Pontianak', 'Kota Singkawang', 'Kota Waringin Barat', 'Kota Waringin Timur',
        'Kubu Raya', 'Mempawah', 'Sambas', 'Sekadau', 'Seruyan', 'Sintang', 'Tanah Laut',
        'Tapin',
    ],

    // ── Sulawesi ─────────────────────────────────────────────────────
    'Sulawesi Zona 1' => [
        'Bantaeng', 'Barru', 'Bolaang Mongondow', 'Bulukumba', 'Gorontalo', 'Gowa',
        'Jeneponto', 'Kota Kotamobagu', 'Kota Makassar', 'Kota Manado', 'Kota Pare-Pare',
        'Kota Tomohon', 'Maros', 'Minahasa', 'Minahasa Selatan', 'Minahasa Tenggara',
        'Pangkajene Dan Kepulauan', 'Pinrang', 'Sidenreng Rappang', 'Soppeng', 'Takalar',
        'Bolaang Mongondow Selatan', 'Bolaang Mongondow Timur', 'Bone', 'Kota Bitung',
        'Kota Palopo', 'Kota Palu', 'Luwu', 'Majene', 'Minahasa Utara', 'Polewali Mandar',
        'Sinjai',
    ],
    'Sulawesi Zona 2' => [
        'Bolaang Mongondow Utara', 'Kepulauan Selayar', 'Kota Gorontalo', 'Mamasa',
        'Banggai', 'Boalemo', 'Wajo', 'Bone Bolango', 'Donggala', 'Gorontalo Utara',
        'Kolaka Timur', 'Kolaka Utara', 'Kota Kendari', 'Luwu Timur', 'Luwu Utara',
        'Mamuju', 'Mamuju Tengah', 'Mamuju Utara', 'Muna', 'Parigi Moutong', 'Poso',
        'Toraja Utara',
    ],
    'Sulawesi Zona 3' => [
        'Banggai Kepulauan', 'Banggai Laut', 'Bombana', 'Buol', 'Buton', 'Buton Selatan',
        'Buton Tengah', 'Buton Utara', 'Enrekang', 'Halmahera Barat', 'Halmahera Selatan',
        'Halmahera Tengah', 'Halmahera Timur', 'Halmahera Utara', 'Kepulauan Sangihe',
        'Kepulauan Sula', 'Kepulauan Talaud', 'Kolaka', 'Konawe', 'Konawe Kepulauan',
        'Konawe Selatan', 'Konawe Utara', 'Kota Baubau', 'Kota Ternate',
        'Kota Tidore Kepulauan', 'Morowali', 'Morowali Utara', 'Muna Barat', 'Pohuwato',
        'Pulau Morotai', 'Pulau Taliabu', 'Siau Tagulandang Biaro', 'Sigi', 'Tana Toraja',
        'Tojo Una-Una', 'Toli-Toli', 'Wakatobi',
    ],
    'Sulawesi Zona 3 Baru' => [
        'Bantaeng', 'Barru', 'Bone Bolango', 'Bulukumba', 'Gorontalo', 'Gorontalo Utara',
        'Gowa', 'Jeneponto', 'Kota Bitung', 'Kota Gorontalo', 'Kota Makassar',
        'Kota Manado', 'Kota Pare-Pare', 'Kota Tomohon', 'Maros', 'Minahasa',
        'Minahasa Utara', 'Pangkajene Dan Kepulauan', 'Pinrang', 'Sidenreng Rappang',
        'Takalar',
    ],
];
