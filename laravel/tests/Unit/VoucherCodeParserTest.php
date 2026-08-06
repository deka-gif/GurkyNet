<?php

namespace Tests\Unit;

use App\Support\VoucherCodeParser;
use PHPUnit\Framework\TestCase;

class VoucherCodeParserTest extends TestCase
{
    public function test_parses_plain_voucher_code(): void
    {
        $parsed = VoucherCodeParser::parse('ALFA-9812-3981-2391');

        $this->assertSame('ALFA-9812-3981-2391', $parsed['voucher_code']);
        $this->assertNull($parsed['voucher_url']);
        $this->assertSame('ALFA-9812-3981-2391', $parsed['voucher_barcode']);
    }

    public function test_parses_url_only_sn(): void
    {
        $parsed = VoucherCodeParser::parse('https://voucher.example.com/claim/abc123');

        $this->assertNull($parsed['voucher_code']);
        $this->assertSame('https://voucher.example.com/claim/abc123', $parsed['voucher_url']);
        $this->assertNull($parsed['voucher_barcode']);
    }

    public function test_parses_labeled_pin(): void
    {
        $parsed = VoucherCodeParser::parse('PIN:ABCD-1234-EFGH');

        $this->assertSame('ABCD-1234-EFGH', $parsed['voucher_code']);
    }

    public function test_empty_sn_returns_nulls(): void
    {
        $parsed = VoucherCodeParser::parse(null);

        $this->assertNull($parsed['voucher_code']);
        $this->assertNull($parsed['voucher_url']);
        $this->assertNull($parsed['voucher_barcode']);
    }
}
