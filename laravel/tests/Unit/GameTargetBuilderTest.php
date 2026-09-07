<?php

namespace Tests\Unit;

use App\Services\Game\GameNicknameResolver;
use App\Services\Game\GameTargetBuilder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class GameTargetBuilderTest extends TestCase
{
    use RefreshDatabase;

    public function test_fc_mobile_customer_no_is_uid(): void
    {
        $resolver = app(GameNicknameResolver::class);
        $builder = app(GameTargetBuilder::class);
        $schema = $resolver->resolveForProduct('FC Mobile', 'pre33639303');

        $this->assertSame('account', $schema['delivery']);
        $this->assertSame(['user_id'], collect($schema['fields'])->pluck('key')->all());

        $customerNo = $builder->buildCustomerNo(['user_id' => 'EA12345'], $schema);
        $this->assertSame('EA12345', $customerNo);
        $builder->assertValidCustomerNo($customerNo, $schema);
    }

    public function test_garena_customer_no_is_garena_id(): void
    {
        $resolver = app(GameNicknameResolver::class);
        $builder = app(GameTargetBuilder::class);
        $schema = $resolver->resolveForProduct('GARENA', 'pre33817227');

        $this->assertSame('account', $schema['delivery']);
        $this->assertSame(['garena_id'], collect($schema['fields'])->pluck('key')->all());

        $customerNo = $builder->buildCustomerNo(['garena_id' => 'garena99'], $schema);
        $this->assertSame('garena99', $customerNo);
    }

    public function test_ml_customer_no_is_user_pipe_zone(): void
    {
        $resolver = app(GameNicknameResolver::class);
        $builder = app(GameTargetBuilder::class);
        $schema = $resolver->resolveForProduct('MOBILE LEGENDS', 'pre33639301');

        $this->assertSame('account', $schema['delivery']);
        $this->assertSame(['user_id', 'zone_id'], collect($schema['fields'])->pluck('key')->all());

        $customerNo = $builder->buildCustomerNo([
            'user_id' => '12345678',
            'zone_id' => '2345',
        ], $schema);
        $this->assertSame('12345678|2345', $customerNo);
        $builder->assertValidCustomerNo($customerNo, $schema);
    }

    public function test_ml_rejects_missing_zone(): void
    {
        $resolver = app(GameNicknameResolver::class);
        $builder = app(GameTargetBuilder::class);
        $schema = $resolver->resolveForProduct('MOBILE LEGENDS', 'pre33639301');

        $this->expectException(ValidationException::class);
        $builder->assertValidCustomerNo('12345678', $schema);
    }

    public function test_free_fire_and_mlweek_remain_unknown(): void
    {
        $resolver = app(GameNicknameResolver::class);
        foreach (['ff12', 'ff50', 'ff140', 'ff355', 'pre33817245', 'mlweek'] as $sku) {
            $schema = $resolver->resolveForProduct('Game', $sku);
            $this->assertSame('unknown', $schema['delivery'], $sku);
            $this->assertSame([], $schema['fields'], $sku);
        }
    }

    public function test_cek_username_is_non_purchase(): void
    {
        $resolver = app(GameNicknameResolver::class);
        $this->assertTrue($resolver->isNonPurchaseSku('pre33639299'));
        $this->assertTrue($resolver->isNonPurchaseSku('pre33817254'));
        $this->assertFalse($resolver->isNonPurchaseSku('pre33639301'));
    }

    public function test_unknown_schema_cannot_build_customer_no(): void
    {
        $builder = app(GameTargetBuilder::class);
        $this->expectException(ValidationException::class);
        $builder->buildCustomerNo(['user_id' => 'x'], [
            'delivery' => 'unknown',
            'fields' => [],
        ]);
    }
}
