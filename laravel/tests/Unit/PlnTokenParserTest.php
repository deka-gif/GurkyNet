<?php

namespace Tests\Unit;

use App\Support\PlnTokenParser;
use PHPUnit\Framework\TestCase;

class PlnTokenParserTest extends TestCase
{
    public function test_extracts_twenty_digit_token_from_plain_sn(): void
    {
        $this->assertSame(
            '12345678901234567890',
            PlnTokenParser::extract('12345678901234567890')
        );
    }

    public function test_extracts_token_from_slash_delimited_digiflazz_sn(): void
    {
        $sn = '141234567890/AMINAH/12345678901234567890/50.0';
        $this->assertSame('12345678901234567890', PlnTokenParser::extract($sn));
        $this->assertSame(
            '1234 - 5678 - 9012 - 3456 - 7890',
            PlnTokenParser::formatGrouped($sn)
        );
    }

    public function test_returns_null_when_no_token_present(): void
    {
        $this->assertNull(PlnTokenParser::extract('PENDING'));
        $this->assertNull(PlnTokenParser::extract(''));
        $this->assertNull(PlnTokenParser::extract(null));
    }
}
