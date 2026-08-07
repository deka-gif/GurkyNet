<?php

namespace Tests\Unit;

use App\Services\ProductProviders\VipOrderPayload;
use PHPUnit\Framework\TestCase;

class VipOrderPayloadTest extends TestCase
{
    public function test_extracts_trxid_from_associative_create_payload(): void
    {
        $extracted = VipOrderPayload::extract([
            'result' => true,
            'data' => [
                'trxid' => '991122',
                'status' => 'waiting',
                'note' => 'Menunggu',
            ],
        ]);

        $this->assertSame('991122', $extracted['trxid']);
        $this->assertSame('pending', $extracted['status']);
    }

    public function test_extracts_from_list_status_payload_and_prefers_trxid(): void
    {
        $extracted = VipOrderPayload::extract([
            'result' => true,
            'data' => [
                ['trxid' => '111', 'status' => 'pending', 'note' => 'a'],
                ['trxid' => '222', 'status' => 'success', 'note' => 'SN:ABC', 'sn' => 'ABC'],
            ],
        ], '222');

        $this->assertSame('222', $extracted['trxid']);
        $this->assertSame('success', $extracted['status']);
        $this->assertSame('ABC', $extracted['sn']);
    }

    public function test_list_without_prefer_uses_first_row(): void
    {
        $extracted = VipOrderPayload::extract([
            'data' => [
                ['trxid' => 'A1', 'status' => 'processing'],
            ],
        ]);

        $this->assertSame('A1', $extracted['trxid']);
        $this->assertSame('pending', $extracted['status']);
    }

    public function test_normalizes_failed_vocabulary(): void
    {
        $this->assertSame('failed', VipOrderPayload::normalizeStatus('error'));
        $this->assertSame('failed', VipOrderPayload::normalizeStatus('gagal'));
        $this->assertSame('success', VipOrderPayload::normalizeStatus('sukses'));
        $this->assertSame('pending', VipOrderPayload::normalizeStatus('waiting'));
        $this->assertSame('pending', VipOrderPayload::normalizeStatus('processing'));
    }

    public function test_official_pdf_statuses_are_supported(): void
    {
        $this->assertSame(
            ['waiting', 'processing', 'success', 'error'],
            VipOrderPayload::officialStatuses()
        );
    }

    public function test_status_payload_list_parsing_from_pdf_example(): void
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
