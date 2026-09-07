<?php

namespace Tests\Unit;

use App\Services\Game\GameDigiflazzHintReader;
use Tests\TestCase;

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

    public function test_diamond_only_desc_is_null(): void
    {
        $reader = app(GameDigiflazzHintReader::class);
        $this->assertNull($reader->parseDesc('70 Diamonds'));
        $this->assertNull($reader->parseDesc('-'));
        $this->assertNull($reader->parseDesc(''));
    }

    public function test_bare_id_or_nomor_is_not_enough(): void
    {
        $reader = app(GameDigiflazzHintReader::class);
        $this->assertNull($reader->parseDesc('Masukkan nomor pelanggan'));
        $this->assertNull($reader->parseDesc('Bonus id bisa berubah'));
    }
}
