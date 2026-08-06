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
    }
}
