<?php

namespace App\Support;

/**
 * Lightweight city → province matcher for grouping Digiflazz PBB/SAMSAT catalog brands.
 * Geographic labels only — never tax amounts, owner names, or plate numbers.
 */
class WilayahMatcher
{
    /**
     * @return array<string, string> normalized city needle => province
     */
    public static function cityToProvince(): array
    {
        static $map = null;
        if ($map !== null) {
            return $map;
        }

        $raw = [
            'Aceh' => ['banda aceh', 'sabang', 'lhokseumawe', 'langsa', 'subulussalam', 'aceh'],
            'Sumatera Utara' => ['medan', 'binjai', 'pematangsiantar', 'tebing tinggi', 'tanjungbalai', 'sibolga', 'padangsidimpuan', 'gunungsitoli', 'deli serdang', 'langkat', 'simalungun', 'asahan', 'nias', 'tapanuli'],
            'Sumatera Barat' => ['padang', 'bukittinggi', 'payakumbuh', 'pariaman', 'solok', 'sawahlunto', 'agam', 'tanah datar', 'mentawai'],
            'Riau' => ['pekanbaru', 'dumai', 'bengkalis', 'kampar', 'siak', 'rokan', 'indragiri', 'pelalawan', 'kuantan'],
            'Kepulauan Riau' => ['batam', 'tanjungpinang', 'bintan', 'karimun', 'natuna', 'lingga', 'anambas'],
            'Jambi' => ['jambi', 'sungai penuh', 'kerinci', 'batanghari', 'bungo', 'tebo', 'merangin', 'sarolangun'],
            'Sumatera Selatan' => ['palembang', 'lubuklinggau', 'prabumulih', 'pagar alam', 'banyuasin', 'muara enim', 'lahat', 'ogan', 'musi'],
            'Bangka Belitung' => ['pangkalpinang', 'bangka', 'belitung'],
            'Bengkulu' => ['bengkulu', 'rejang lebong', 'kepahiang', 'mukomuko', 'seluma'],
            'Lampung' => ['bandar lampung', 'metro', 'lampung', 'tanggamus', 'pesawaran', 'pringsewu', 'mesuji', 'tulang bawang'],
            'DKI Jakarta' => ['jakarta', 'kepulauan seribu'],
            'Jawa Barat' => ['bandung', 'bekasi', 'bogor', 'cimahi', 'cirebon', 'depok', 'sukabumi', 'tasikmalaya', 'banjar', 'garut', 'karawang', 'purwakarta', 'subang', 'sumedang', 'indramayu', 'majalengka', 'kuningan', 'cianjur', 'ciamis', 'pangandaran'],
            'Banten' => ['serang', 'cilegon', 'tangerang', 'lebak', 'pandeglang'],
            'Jawa Tengah' => ['semarang', 'solo', 'surakarta', 'magelang', 'pekalongan', 'tegal', 'salatiga', 'banyumas', 'cilacap', 'kudus', 'jepara', 'demak', 'kendal', 'batang', 'pemalang', 'brebes', 'purwokerto', 'klaten', 'boyolali', 'sragen', 'karanganyar', 'wonogiri', 'sukoharjo', 'grobogan', 'blora', 'pati', 'rembang', 'temanggung', 'wonosobo', 'purbalingga', 'banjarnegara', 'kebumen', 'purworejo'],
            'DI Yogyakarta' => ['yogyakarta', 'yogya', 'bantul', 'sleman', 'kulon progo', 'gunungkidul', 'gunung kidul'],
            'Jawa Timur' => ['surabaya', 'malang', 'kediri', 'blitar', 'mojokerto', 'madiun', 'pasuruan', 'probolinggo', 'batu', 'sidoarjo', 'gresik', 'lamongan', 'tuban', 'bojonegoro', 'jombang', 'nganjuk', 'magetan', 'ngawi', 'ponorogo', 'pacitan', 'trenggalek', 'tulungagung', 'jember', 'banyuwangi', 'bondowoso', 'situbondo', 'lumajang', 'bangkalan', 'sampang', 'pamekasan', 'sumenep'],
            'Bali' => ['denpasar', 'badung', 'gianyar', 'tabanan', 'buleleng', 'karangasem', 'klungkung', 'bangli', 'jembrana'],
            'Nusa Tenggara Barat' => ['mataram', 'bima', 'lombok', 'sumbawa', 'dompu'],
            'Nusa Tenggara Timur' => ['kupang', 'ende', 'maumere', 'labuan bajo', 'manggarai', 'sumba', 'alor', 'flores', 'belu', 'ttu', 'tts'],
            'Kalimantan Barat' => ['pontianak', 'singkawang', 'sambas', 'kubu raya', 'mempawah', 'sanggau', 'sintang', 'ketapang', 'landak', 'bengkayang', 'sekadau', 'melawi', 'kayong'],
            'Kalimantan Tengah' => ['palangka raya', 'palangkaraya', 'kapuas', 'kotawaringin', 'sampit', 'pangkalan bun', 'murung raya', 'barito', 'katingan', 'seruyan'],
            'Kalimantan Selatan' => ['banjarmasin', 'banjarbaru', 'banjar', 'tanah laut', 'tapin', 'hulu sungai', 'tabalong', 'balangan', 'kotabaru', 'tanah bumbu'],
            'Kalimantan Timur' => ['balikpapan', 'samarinda', 'bontang', 'kutai', 'berau', 'paser', 'penajam'],
            'Kalimantan Utara' => ['tarakan', 'bulungan', 'nunukan', 'malinau', 'tana tidung'],
            'Sulawesi Utara' => ['manado', 'bitung', 'tomohon', 'kotamobagu', 'minahasa', 'bolaang', 'sangihe', 'talaud'],
            'Sulawesi Tengah' => ['palu', 'poso', 'donggala', 'morowali', 'banggai', 'toluoli', 'sigi', 'parigi'],
            'Sulawesi Selatan' => ['makassar', 'ujung pandang', 'parepare', 'palopo', 'gowa', 'maros', 'bone', 'wajo', 'soppeng', 'sidrap', 'pinrang', 'enrekang', 'toraja', 'luwu', 'bulukumba', 'bantaeng', 'jeneponto', 'takalar', 'pangkep', 'barru', 'sinjai', 'selayar'],
            'Sulawesi Tenggara' => ['kendari', 'baubau', 'kolaka', 'konawe', 'muna', 'buton', 'wakatobi', 'bombana'],
            'Gorontalo' => ['gorontalo', 'boalemo', 'bone bolango', 'pohuwato'],
            'Sulawesi Barat' => ['mamuju', 'majene', 'polewali', 'mamasa', 'pasangkayu'],
            'Maluku' => ['ambon', 'tual', 'maluku', 'seram', 'buru', 'aru', 'tanimbar'],
            'Maluku Utara' => ['ternate', 'tidore', 'halmahera', 'morotai', 'sula', 'taliabu'],
            'Papua' => ['jayapura', 'biak', 'sarmi', 'yapen', 'keerom', 'waropen'],
            'Papua Barat' => ['manokwari', 'sorong', 'fakfak', 'kaimana', 'bintuni', 'wondama'],
            'Papua Selatan' => ['merauke', 'mappi', 'asmat', 'boven digoel'],
            'Papua Tengah' => ['nabire', 'mimika', 'timika', 'paniai', 'dogiyai', 'deiyai', 'puncak'],
            'Papua Pegunungan' => ['jayawijaya', 'wamena', 'yahukimo', 'tolikara', 'lanny', 'nduga', 'yalimo'],
            'Papua Barat Daya' => ['raja ampat', 'maybrat', 'tambrauw', 'sorong selatan'],
        ];

        $map = [];
        foreach ($raw as $province => $needles) {
            foreach ($needles as $needle) {
                $map[self::norm($needle)] = $province;
            }
        }

        return $map;
    }

    public static function resolveProvince(string $text): string
    {
        $hay = self::norm($text);
        if ($hay === '') {
            return 'Lainnya';
        }

        // Direct province name hit
        foreach (array_unique(array_values(self::cityToProvince())) as $province) {
            if (str_contains($hay, self::norm($province))) {
                return $province;
            }
        }

        $bestProvince = 'Lainnya';
        $bestLen = 0;
        foreach (self::cityToProvince() as $needle => $province) {
            if ($needle !== '' && str_contains($hay, $needle) && strlen($needle) > $bestLen) {
                $bestLen = strlen($needle);
                $bestProvince = $province;
            }
        }

        return $bestProvince;
    }

    public static function cityLabel(string $productName, string $operatorName): string
    {
        $label = trim($operatorName !== '' ? $operatorName : $productName);
        $label = preg_replace('/\b(pbb|samsat|pajak|bumi|bangunan|kendaraan|token)\b/iu', '', $label) ?? $label;
        $label = trim(preg_replace('/\s+/', ' ', $label) ?? $label);

        return $label !== '' ? $label : trim($productName);
    }

    public static function norm(string $value): string
    {
        $value = strtolower(trim($value));
        $value = preg_replace('/[^a-z0-9\s]/', ' ', $value) ?? $value;

        return trim(preg_replace('/\s+/', ' ', $value) ?? $value);
    }
}
