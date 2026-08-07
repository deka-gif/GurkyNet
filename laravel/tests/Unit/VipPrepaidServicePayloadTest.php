<?php

namespace Tests\Unit;

use App\Services\ProductProviders\VipOrderPayload;
use App\Services\ProductProviders\VipPrepaidServicePayload;
use PHPUnit\Framework\TestCase;

class VipPrepaidServicePayloadTest extends TestCase
{
    public function test_parses_official_services_fields_including_price_tiers(): void
    {
        $normalized = VipPrepaidServicePayload::normalize([
            'brand' => 'XL',
            'code' => 'XLDHR3',
            'name' => 'XL HOTROD 3 GB / 30 Hari',
            'note' => '-',
            'price' => [
                'basic' => 48225,
                'premium' => 48200,
                'special' => 48175,
            ],
            'status' => 'available',
            'multi_trx' => true,
            'maintenace' => '23:44 - 00:16',
            'category' => 'Hotrod',
            'prepost' => 'prepaid',
            'type' => 'paket-internet',
        ]);

        $this->assertSame('XL', $normalized['brand']);
        $this->assertSame('XLDHR3', $normalized['code']);
        $this->assertSame('available', $normalized['status']);
        $this->assertTrue($normalized['multi_trx']);
        $this->assertSame('23:44 - 00:16', $normalized['maintenace']);
        $this->assertSame('Hotrod', $normalized['category']);
        $this->assertSame('prepaid', $normalized['prepost']);
        $this->assertSame('paket-internet', $normalized['type']);
        $this->assertSame(48225.0, $normalized['resolved_price']);
        $this->assertSame(48225.0, $normalized['price']['basic']);
        $this->assertSame(48200.0, $normalized['price']['premium']);
        $this->assertSame(48175.0, $normalized['price']['special']);
        $this->assertArrayHasKey('price_tiers', $normalized['meta']);
        $this->assertSame('23:44 - 00:16', $normalized['meta']['maintenace']);
    }

    public function test_resolves_premium_when_basic_missing(): void
    {
        $normalized = VipPrepaidServicePayload::normalize([
            'code' => 'X1',
            'price' => ['premium' => 1000, 'special' => 900],
            'status' => 'empty',
            'multi_trx' => false,
            'maintenace' => '00:00 - 00:00',
            'category' => 'Pascabayar',
            'prepost' => 'prepaid',
            'type' => 'not-filtered',
        ]);

        $this->assertSame(1000.0, $normalized['resolved_price']);
        $this->assertFalse($normalized['multi_trx']);
        $this->assertSame('empty', $normalized['status']);
    }
}

class VipOrderPayloadOfficialStatusTest extends TestCase
{
    public function test_official_pdf_statuses_are_supported(): void
    {
        $this->assertSame(
            ['waiting', 'processing', 'success', 'error'],
            VipOrderPayload::officialStatuses()
        );

        $this->assertSame('pending', VipOrderPayload::normalizeStatus('waiting'));
        $this->assertSame('pending', VipOrderPayload::normalizeStatus('processing'));
        $this->assertSame('success', VipOrderPayload::normalizeStatus('success'));
        $this->assertSame('failed', VipOrderPayload::normalizeStatus('error'));
    }

    public function test_status_payload_list_parsing(): void
    {
        $extracted = VipOrderPayload::extract([
            'result' => true,
            'data' => [
                [
                    'trxid' => 'some1d',
                    'data' => '087800001233',
                    'code' => 'SHNX25',
                    'service' => 'Xl 25.000',
                    'status' => 'success',
                    'note' => '436846846',
                    'price' => 25000,
                ],
                [
                    'trxid' => 'err1',
                    'data' => '087800001234',
                    'status' => 'error',
                    'note' => 'Nomor tujuan salah.',
                    'price' => 50000,
                ],
            ],
            'message' => 'Detail transaksi berhasil didapatkan.',
        ], 'err1');

        $this->assertSame('err1', $extracted['trxid']);
        $this->assertSame('failed', $extracted['status']);
        $this->assertSame('Nomor tujuan salah.', $extracted['note']);
    }
}
