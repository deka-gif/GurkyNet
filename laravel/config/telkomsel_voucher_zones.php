<?php

/**
 * Reference: Telkomsel Voucher Internet zone_label -> list of kabupaten/kota.
 * Used ONLY as a "pick my city" convenience in the zona picker — the picker's
 * authoritative list is always the real zone_label values present in the catalog
 * (from products.zone_label), never this file. A city missing here just means it
 * won't show up as a clickable shortcut; the user can still pick the zona directly.
 * Keys MUST match products.zone_label exactly (case-sensitive) — verified against
 * a live production query (SELECT DISTINCT zone_label ...) on 2026-08-29.
 *
 * IMPORTANT — "regular" vs "Baru"/"New Variant" Digiflazz boundary schemes:
 * Several zone_label values (e.g. "Sumatera Utara Zona 3") cover BOTH an older
 * boundary scheme and a newer one ("Baru"/"New Variant"), distinguishable only by
 * the product NAME (not by zone_label). For each zone below, the kabupaten list
 * was chosen by checking, in real production data, which scheme's product names
 * actually exist under that exact zone_label:
 *   - If ALL products under a zone_label have plain names (no "Baru"/"Varian Baru"),
 *     only the REGULAR scheme's kabupaten list is used.
 *   - If ALL products have "Baru"/"Varian Baru" in the name, only the NEW VARIANT
 *     list is used.
 *   - If BOTH kinds of product names exist under the same zone_label (a real,
 *     confirmed case for several zones below), the UNION of both schemes' kabupaten
 *     lists is used — this is why some kabupaten/kota appear under more than one
 *     zone number here (e.g. Nias appears under both "Sumatera Utara Zona 1" and
 *     "Sumatera Utara Zona 3" because Digiflazz moved it between schemes). This is
 *     expected and not a data-entry error — it reflects a real ambiguity in
 *     Digiflazz's own zoning history, not something this app can resolve further
 *     without a more granular per-SKU scheme indicator from the provider.
 *
 * Jawa Tengah - DIY vs Jawa Timur: source notes merged these two into one list;
 * split here using standard, well-known Indonesian provincial boundaries (Central
 * Java + DIY vs East Java), not a voucher-zone guess.
 *
 * Jabodetabek vs Jawa Barat: source notes also merged these two. Jabodetabek is
 * populated using its literal meaning (JAkarta-BOgor-DEpok-TAngerang-BEKasi).
 * Jawa Barat is populated with West Java cities that are clearly NOT part of that
 * metro definition. Kabupaten in the genuinely ambiguous border zone were assigned
 * to the more common classification; if this needs correcting, tell me and I'll
 * adjust.
 *
 * "Sukabumi Bogor Banten" and "Jawa Lombok" are DELIBERATELY LEFT EMPTY — no
 * source data distinguishes their exact kabupaten boundaries from neighboring
 * zones (especially since Bogor is already claimed by Jabodetabek above), and a
 * wrong guess here is worse than no search assist. These two zones still work in
 * the picker as a plain label choice (not city-search) until better data arrives.
 *
 * "Variant A Special" (84/124-city, 20/26-city, 3-day/5-day duration eligibility)
 * from the source notes is INTENTIONALLY EXCLUDED — that describes voucher-DURATION
 * eligibility per city, a different concept from zone_label geographic gating, and
 * mixing it in here would misapply the data.
 */

return [

    // ── Sumatera Utara (Northern Sumatra) ───────────────────────────
    // Zona 1 & Zona 2: only "regular"-scheme product names exist under these
    // zone_labels in production right now.
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
    // Zona 3: BOTH regular and "Baru" product names exist -> union of both schemes.
    'Sumatera Utara Zona 3' => [
        'Aceh Tenggara', 'Gayo Lues', 'Gunungsitoli', 'Nias', 'Nias Barat',
        'Nias Selatan', 'Nias Utara',
        'Aceh Besar', 'Aceh Tamiang', 'Aceh Timur', 'Asahan',
        'Batu Bara', 'Dairi', 'Deli Serdang', 'Humbang Hasundutan', 'Karo',
        'Kota Banda Aceh', 'Kota Binjai', 'Kota Langsa', 'Kota Medan',
        'Kota Padangsidimpuan', 'Kota Pematang Siantar', 'Kota Sibolga',
        'Kota Tanjung Balai', 'Kota Tebing Tinggi', 'Labuhan Batu',
        'Labuhan Batu Selatan', 'Labuhan Batu Utara', 'Langkat', 'Mandailing Natal',
        'Padang Lawas', 'Padang Lawas Utara', 'Pakpak Bharat', 'Samosir',
        'Serdang Bedagai', 'Simalungun', 'Tapanuli Selatan', 'Tapanuli Tengah',
        'Tapanuli Utara', 'Toba Samosir',
    ],

    // ── Sumatera Tengah (Central Sumatra) ───────────────────────────
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
    // Zona 3: BOTH regular ("Kepulauan Mentawai" only) and "Baru" names exist -> union.
    'Sumatera Tengah Zona 3' => [
        'Kepulauan Mentawai',
        'Agam', 'Bengkalis', 'Bintan', 'Kampar', 'Kota Batam', 'Kota Bukit Tinggi',
        'Kota Dumai', 'Kota Padang', 'Kota Padang Panjang', 'Kota Pariaman',
        'Kota Payakumbuh', 'Kota Pekanbaru', 'Kota Solok', 'Kota Tanjung Pinang',
        'Lima Puluh Kota', 'Padang Pariaman', 'Pesisir Selatan', 'Rokan Hilir',
        'Siak', 'Solok', 'Tanah Datar',
    ],

    // ── Sumatera Selatan (Southern Sumatra) ─────────────────────────
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
    // Zona 3 has NO "regular" scheme at all — only exists as "Baru".
    'Sumatera Selatan Zona 3' => [
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
    // Zona 2: BOTH regular and "Baru" names exist -> union (regular list + Sumbawa Barat).
    'Bali - Nusa Tenggara Zona 2' => [
        'Alor', 'Belu', 'Bima', 'Dompu', 'Ende', 'Flores Timur', 'Kota Bima',
        'Kota Kupang', 'Kupang', 'Lembata', 'Malaka', 'Manggarai', 'Manggarai Barat',
        'Manggarai Timur', 'Nagekeo', 'Ngada', 'Rote Ndao', 'Sabu Raijua', 'Sikka',
        'Sumba Barat', 'Sumba Barat Daya', 'Sumba Tengah', 'Sumba Timur', 'Sumbawa',
        'Sumbawa Barat', 'Timor Tengah Selatan', 'Timor Tengah Utara',
    ],
    // Zona 3 & 4 only exist as "New Variant" (no regular scheme given for these).
    'Bali - Nusa Tenggara Zona 3' => [
        'Badung', 'Bangli', 'Buleleng', 'Gianyar', 'Jembrana', 'Karang Asem',
        'Klungkung', 'Kota Denpasar', 'Tabanan',
    ],
    'Bali - Nusa Tenggara Zona 4' => [
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
    // Zona 3: BOTH regular and "Varian Baru" names exist -> union.
    'Kalimantan Zona 3' => [
        'Berau', 'Kota Tarakan', 'Kutai Barat', 'Mahakam Ulu', 'Malinau', 'Nunukan',
        'Banjar', 'Barito Kuala', 'Bengkayang', 'Hulu Sungai Selatan', 'Hulu Sungai Tengah',
        'Hulu Sungai Utara', 'Kota Balikpapan', 'Kota Banjar Baru', 'Kota Banjarmasin',
        'Kota Pontianak', 'Kota Singkawang', 'Kota Waringin Barat', 'Kota Waringin Timur',
        'Kubu Raya', 'Mempawah', 'Sambas', 'Sekadau', 'Seruyan', 'Sintang', 'Tanah Laut',
        'Tapin',
    ],

    // ── Sulawesi ────────────────────────────────────────────────────
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
    // Zona 3: BOTH regular and "Baru" names exist -> union.
    'Sulawesi Zona 3' => [
        'Banggai Kepulauan', 'Banggai Laut', 'Bombana', 'Buol', 'Buton', 'Buton Selatan',
        'Buton Tengah', 'Buton Utara', 'Enrekang', 'Halmahera Barat', 'Halmahera Selatan',
        'Halmahera Tengah', 'Halmahera Timur', 'Halmahera Utara', 'Kepulauan Sangihe',
        'Kepulauan Sula', 'Kepulauan Talaud', 'Kolaka', 'Konawe', 'Konawe Kepulauan',
        'Konawe Selatan', 'Konawe Utara', 'Kota Baubau', 'Kota Ternate',
        'Kota Tidore Kepulauan', 'Morowali', 'Morowali Utara', 'Muna Barat', 'Pohuwato',
        'Pulau Morotai', 'Pulau Taliabu', 'Siau Tagulandang Biaro', 'Sigi', 'Tana Toraja',
        'Tojo Una-Una', 'Toli-Toli', 'Wakatobi',
        'Bantaeng', 'Barru', 'Bone Bolango', 'Bulukumba', 'Gorontalo', 'Gorontalo Utara',
        'Gowa', 'Jeneponto', 'Kota Bitung', 'Kota Gorontalo', 'Kota Makassar',
        'Kota Manado', 'Kota Pare-Pare', 'Kota Tomohon', 'Maros', 'Minahasa',
        'Minahasa Utara', 'Pangkajene Dan Kepulauan', 'Pinrang', 'Sidenreng Rappang',
        'Takalar',
    ],

    // ── Jabodetabek (JAkarta-BOgor-DEpok-TAngerang-BEKasi) ──────────
    'Jabodetabek' => [
        'Jakarta Pusat', 'Jakarta Utara', 'Jakarta Barat', 'Jakarta Selatan',
        'Jakarta Timur', 'Kepulauan Seribu', 'Kota Bekasi', 'Bekasi', 'Kota Bogor',
        'Bogor', 'Kota Depok', 'Kota Tangerang', 'Tangerang', 'Kota Tangerang Selatan',
    ],

    // ── Jawa Barat (non-metro West Java) ────────────────────────────
    'Jawa Barat' => [
        'Bandung', 'Bandung Barat', 'Ciamis', 'Cianjur', 'Cirebon', 'Garut',
        'Indramayu', 'Kota Bandung', 'Kota Banjar', 'Kota Cimahi', 'Kota Cirebon',
        'Kota Tasikmalaya', 'Kuningan', 'Majalengka', 'Pangandaran', 'Purwakarta',
        'Karawang', 'Subang', 'Sumedang', 'Tasikmalaya',
    ],

    // ── Jawa Tengah - DIY ────────────────────────────────────────────
    'Jawa Tengah - DIY' => [
        'Banjarnegara', 'Bantul', 'Banyumas', 'Batang', 'Blora', 'Boyolali', 'Brebes',
        'Cilacap', 'Demak', 'Grobogan', 'Gunung Kidul', 'Jepara', 'Karanganyar',
        'Kebumen', 'Kendal', 'Klaten', 'Kota Magelang', 'Kota Pekalongan',
        'Kota Salatiga', 'Kota Semarang', 'Kota Surakarta', 'Kota Tegal',
        'Kota Yogyakarta', 'Kudus', 'Kulon Progo', 'Magelang', 'Pati', 'Pekalongan',
        'Pemalang', 'Purbalingga', 'Purworejo', 'Rembang', 'Semarang', 'Sleman',
        'Sragen', 'Sukoharjo', 'Tegal', 'Temanggung', 'Wonogiri', 'Wonosobo',
    ],

    // ── Jawa Timur ───────────────────────────────────────────────────
    'Jawa Timur' => [
        'Bangkalan', 'Banyuwangi', 'Blitar', 'Bojonegoro', 'Bondowoso', 'Gresik',
        'Jember', 'Jombang', 'Kediri', 'Kota Batu', 'Kota Blitar', 'Kota Kediri',
        'Kota Madiun', 'Kota Malang', 'Kota Mojokerto', 'Kota Pasuruan',
        'Kota Probolinggo', 'Kota Surabaya', 'Lamongan', 'Lumajang', 'Madiun',
        'Magetan', 'Malang', 'Mojokerto', 'Nganjuk', 'Ngawi', 'Pacitan', 'Pamekasan',
        'Pasuruan', 'Ponorogo', 'Probolinggo', 'Sampang', 'Sidoarjo', 'Situbondo',
        'Sumenep', 'Trenggalek', 'Tuban', 'Tulungagung',
    ],

    // 'Sukabumi Bogor Banten' and 'Jawa Lombok' intentionally omitted — see doc
    // comment above. Both remain selectable in the picker as a plain zona label,
    // just without a "search my city" shortcut, until better source data arrives.

];
