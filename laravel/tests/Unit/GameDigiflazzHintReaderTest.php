<?php

namespace Tests\Unit;

use App\Services\Game\GameDigiflazzHintReader;
use Tests\TestCase;

/**
 * Patterns must match real Digiflazz `desc` text only — fail-closed otherwise.
 */
class GameDigiflazzHintReaderTest extends TestCase
{
    public function test_masukkan_uid_maps_to_user_id(): void
    {
        $reader = app(GameDigiflazzHintReader::class);
        $parsed = $reader->parseDesc('40 + 8 Bonus, Bonus bisa berubah. Masukkan UID.');

        $this->assertNotNull($parsed);
        $this->assertSame('account', $parsed['delivery']);
        $this->assertSame(['user_id'], collect($parsed['fields'])->pluck('key')->all());
    }

    public function test_user_id_and_zone_id_combo(): void
    {
        $reader = app(GameDigiflazzHintReader::class);
        $parsed = $reader->parseDesc('no pelanggan = gabungan antara user_id dan zone_id');

        $this->assertNotNull($parsed);
        $this->assertSame(['user_id', 'zone_id'], collect($parsed['fields'])->pluck('key')->all());
    }

    public function test_genshin_uid_pipe_server_format(): void
    {
        $reader = app(GameDigiflazzHintReader::class);
        $parsed = $reader->parseDesc('Format no tujuan [UID]|[Server]');

        $this->assertNotNull($parsed);
        $this->assertSame(['user_id', 'server_id'], collect($parsed['fields'])->pluck('key')->all());
        $this->assertSame('UID', $parsed['fields'][0]['label']);
        $this->assertSame('Server', $parsed['fields'][1]['label']);
    }

    public function test_masukkan_id_and_id_akun(): void
    {
        $reader = app(GameDigiflazzHintReader::class);

        $id = $reader->parseDesc('Masukkan ID');
        $this->assertNotNull($id);
        $this->assertSame(['user_id'], collect($id['fields'])->pluck('key')->all());

        $akun = $reader->parseDesc('Masukkan ID Akun');
        $this->assertNotNull($akun);
        $this->assertSame(['user_id'], collect($akun['fields'])->pluck('key')->all());
    }

    public function test_masukkan_username(): void
    {
        $reader = app(GameDigiflazzHintReader::class);

        $a = $reader->parseDesc('Masukkan username.');
        $this->assertNotNull($a);
        $this->assertSame('Username', $a['fields'][0]['label']);

        $b = $reader->parseDesc('masukkan username akun game anda.');
        $this->assertNotNull($b);
        $this->assertSame(['user_id'], collect($b['fields'])->pluck('key')->all());
    }

    public function test_diamond_only_and_product_name_desc_is_null(): void
    {
        $reader = app(GameDigiflazzHintReader::class);
        $this->assertNull($reader->parseDesc('70 Diamonds'));
        $this->assertNull($reader->parseDesc('-'));
        $this->assertNull($reader->parseDesc(''));
        $this->assertNull($reader->parseDesc('PUBG MOBILE 16 UC'));
        $this->assertNull($reader->parseDesc('AOV 7 Vouchers'));
        $this->assertNull($reader->parseDesc('Token Utama, bonus sesuai akun pengguna'));
        $this->assertNull($reader->parseDesc('Kartu Upgrade Royal Pass + Bonus'));
        $this->assertNull($reader->parseDesc('Call of Duty Mobile 26CP'));
        $this->assertNull($reader->parseDesc('Laplace M 60 Spirals'));
        $this->assertNull($reader->parseDesc('1200 Point Blank Cash'));
        $this->assertNull($reader->parseDesc('1 Big Cat Coins'));
    }

    public function test_bare_id_or_nomor_or_phone_is_not_enough(): void
    {
        $reader = app(GameDigiflazzHintReader::class);
        $this->assertNull($reader->parseDesc('Masukkan nomor pelanggan'));
        $this->assertNull($reader->parseDesc('Bonus id bisa berubah'));
        // Razer Gold Digi desc — phone is not auto-activated for Game top-up
        $this->assertNull($reader->parseDesc('Masukkan No Hp terdaftar di web Razer'));
    }

    /**
     * Production unique descs for previously-hidden Digi Games brands (Stage 3).
     */
    public function test_production_hidden_brand_desc_corpus(): void
    {
        $reader = app(GameDigiflazzHintReader::class);

        $shouldDetect = [
            'Format no tujuan [UID]|[Server]' => ['user_id', 'server_id'],
            'Masukkan ID' => ['user_id'],
            'Masukkan ID Akun' => ['user_id'],
            'Masukkan username.' => ['user_id'],
            'masukkan username akun game anda.' => ['user_id'],
        ];
        foreach ($shouldDetect as $desc => $keys) {
            $parsed = $reader->parseDesc($desc);
            $this->assertNotNull($parsed, "Expected detect: {$desc}");
            $this->assertSame($keys, collect($parsed['fields'])->pluck('key')->all(), $desc);
        }

        $shouldStayNull = [
            'Kartu Upgrade Royal Pass + Bonus',
            'Kartu Upgrade Elite Pass Plus + Bonus',
            '-',
            'Cek username PUBG MOBILE',
            'PUBG MOBILE 16 UC',
            'PUBG MOBILE 5000 UC',
            'Token Utama, bonus sesuai akun pengguna',
            'AOV 7 Vouchers',
            'AOV 90 Vouchers',
            'AU2 Mobile 72 Diamonds',
            'Call of Duty Mobile 26CP',
            'Call of Duty Mobile 31 CP',
            'Laplace M 60 Spirals',
            '1200 Point Blank Cash',
            '2400 PB Cash',
            '1 Big Cat Coins',
            '3 Big Cat Coins',
            'Masukkan No Hp terdaftar di web Razer',
        ];
        foreach ($shouldStayNull as $desc) {
            $this->assertNull($reader->parseDesc($desc), "Must stay fail-closed: {$desc}");
        }
    }
}
