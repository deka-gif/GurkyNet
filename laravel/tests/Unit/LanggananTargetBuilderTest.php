<?php

namespace Tests\Unit;

use App\Services\Langganan\LanggananTargetBuilder;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class LanggananTargetBuilderTest extends TestCase
{
    public function test_voucher_builds_placeholder(): void
    {
        $builder = app(LanggananTargetBuilder::class);
        $this->assertSame('LANGGANAN', $builder->buildCustomerNo([], [
            'delivery' => 'voucher',
            'fields' => [],
        ]));
    }

    public function test_unknown_fail_closed(): void
    {
        $builder = app(LanggananTargetBuilder::class);

        $this->expectException(ValidationException::class);
        $builder->buildCustomerNo([], [
            'delivery' => 'unknown',
            'fields' => [],
        ]);
    }

    public function test_empty_fields_account_fail_closed(): void
    {
        $builder = app(LanggananTargetBuilder::class);

        $this->expectException(ValidationException::class);
        $builder->assertValidTarget('LANGGANAN', [
            'delivery' => 'unknown',
            'fields' => [],
        ]);
    }

    public function test_phone_account_builds_digits(): void
    {
        $builder = app(LanggananTargetBuilder::class);
        $target = $builder->buildCustomerNo(
            ['phone' => '081234567890'],
            [
                'delivery' => 'account',
                'fields' => [
                    ['key' => 'phone', 'label' => 'Nomor HP', 'required' => true, 'input' => 'phone'],
                ],
            ]
        );

        $this->assertSame('081234567890', $target);
    }
}
