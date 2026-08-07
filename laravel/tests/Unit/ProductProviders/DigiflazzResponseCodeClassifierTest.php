<?php

namespace Tests\Unit\ProductProviders;

use App\Services\ProductProviders\DigiflazzResponseCodeClassifier;
use App\Services\ProductProviders\ProviderFailoverPolicy;
use App\Services\ProductProviders\ProviderHealthStatus;
use PHPUnit\Framework\TestCase;

class DigiflazzResponseCodeClassifierTest extends TestCase
{
    public function test_success_rc_00(): void
    {
        $c = DigiflazzResponseCodeClassifier::classify('00');

        $this->assertTrue($c->isSuccess());
        $this->assertFalse($c->isPending());
        $this->assertFalse($c->isRetryable());
        $this->assertFalse($c->isRefundable());
        $this->assertTrue($c->transactionCreated());
        $this->assertSame(DigiflazzResponseCodeClassifier::SUCCESS, $c->category);
        $this->assertSame('Transaksi Sukses', $c->description());
        $this->assertFalse($c->allowsFailover());
    }

    public function test_pending_rc_03_and_99(): void
    {
        foreach (['03', '99'] as $rc) {
            $c = DigiflazzResponseCodeClassifier::classify($rc);
            $this->assertTrue($c->isPending(), "RC {$rc}");
            $this->assertTrue($c->isRetryable(), "RC {$rc}");
            $this->assertTrue($c->transactionCreated(), "RC {$rc}");
            $this->assertFalse($c->allowsFailover(), "RC {$rc}");
            $this->assertSame('pending', $c->fulfillmentReason());
        }
    }

    public function test_authentication_rc_41_42_45(): void
    {
        foreach (['41', '42', '45'] as $rc) {
            $c = DigiflazzResponseCodeClassifier::classify($rc);
            $this->assertTrue($c->isAuthenticationFailure(), "RC {$rc}");
            $this->assertSame(DigiflazzResponseCodeClassifier::AUTHENTICATION, $c->category);
            $this->assertFalse($c->transactionCreated(), "RC {$rc}");
            $this->assertSame('authentication_failure', $c->fulfillmentReason());
        }

        $this->assertSame(ProviderHealthStatus::AUTH_FAILED, DigiflazzResponseCodeClassifier::classify('41')->healthStatus());
        $this->assertSame(ProviderHealthStatus::AUTH_FAILED, DigiflazzResponseCodeClassifier::classify('42')->healthStatus());
        $this->assertSame(ProviderHealthStatus::NETWORK_CONFIGURATION, DigiflazzResponseCodeClassifier::classify('45')->healthStatus());
    }

    public function test_validation_rcs_are_permanent_and_non_failover(): void
    {
        $codes = ['40', '43', '47', '49', '51', '52', '54', '57', '59', '63', '72', '73', '84', '87'];

        foreach ($codes as $rc) {
            $c = DigiflazzResponseCodeClassifier::classify($rc);
            $this->assertTrue($c->isValidationFailure(), "RC {$rc}");
            $this->assertTrue($c->permanentFailure, "RC {$rc}");
            $this->assertFalse($c->isRetryable(), "RC {$rc}");
            $this->assertFalse($c->allowsFailover(), "RC {$rc}");
            $this->assertSame('customer_validation', $c->fulfillmentReason());
        }
    }

    public function test_provider_issue_rcs_are_retryable(): void
    {
        foreach (['53', '55', '58', '62', '66', '68', '71'] as $rc) {
            $c = DigiflazzResponseCodeClassifier::classify($rc);
            $this->assertTrue($c->isProviderFailure() || $c->isRetryable(), "RC {$rc}");
            $this->assertTrue($c->isRetryable(), "RC {$rc}");
            $this->assertTrue($c->allowsFailover(), "RC {$rc}");
        }
    }

    public function test_refund_rc_74(): void
    {
        $c = DigiflazzResponseCodeClassifier::classify('74');

        $this->assertSame(DigiflazzResponseCodeClassifier::REFUND, $c->category);
        $this->assertTrue($c->isRefundable());
        $this->assertTrue($c->transactionCreated());
        $this->assertFalse($c->allowsFailover());
        $this->assertSame('digiflazz_refund', $c->fulfillmentReason());
    }

    public function test_retry_timeout_and_rate_limit_rcs(): void
    {
        foreach (['01', '70'] as $rc) {
            $c = DigiflazzResponseCodeClassifier::classify($rc);
            $this->assertTrue($c->isRetryable(), "RC {$rc}");
            $this->assertTrue($c->isRefundable(), "RC {$rc}");
            $this->assertSame('timeout', $c->fulfillmentReason());
        }

        foreach (['83', '85', '86'] as $rc) {
            $c = DigiflazzResponseCodeClassifier::classify($rc);
            $this->assertTrue($c->isRateLimited(), "RC {$rc}");
            $this->assertTrue($c->isRetryable(), "RC {$rc}");
            $this->assertSame('rate_limited', $c->fulfillmentReason());
            $this->assertTrue($c->allowsFailover(), "RC {$rc}");
        }
    }

    public function test_deprecated_rcs_56_and_65_remain_recognized(): void
    {
        foreach (['56', '65'] as $rc) {
            $c = DigiflazzResponseCodeClassifier::classify($rc);
            $this->assertTrue($c->isDeprecated(), "RC {$rc}");
            $this->assertFalse($c->isUnknown(), "RC {$rc}");
            $this->assertSame(DigiflazzResponseCodeClassifier::BUSINESS, $c->category);
        }
    }

    public function test_unknown_rc_does_not_crash(): void
    {
        $c = DigiflazzResponseCodeClassifier::classify('199');

        $this->assertTrue($c->isUnknown());
        $this->assertSame('199', $c->code);
        $this->assertSame(DigiflazzResponseCodeClassifier::UNKNOWN, $c->category);
        $this->assertFalse($c->isRetryable());
        $this->assertTrue($c->permanentFailure);
    }

    public function test_transaction_created_true_vs_false(): void
    {
        $created = DigiflazzResponseCodeClassifier::classify('02');
        $this->assertTrue($created->transactionCreated());
        $this->assertTrue($created->isRefundable());

        $notCreated = DigiflazzResponseCodeClassifier::classify('41');
        $this->assertFalse($notCreated->transactionCreated());
        $this->assertFalse($notCreated->isRefundable());

        $refund = DigiflazzResponseCodeClassifier::classify('74');
        $this->assertTrue($refund->transactionCreated());
        $this->assertTrue($refund->isRefundable());
    }

    public function test_normalize_zero_pads_official_rcs(): void
    {
        $this->assertSame('00', DigiflazzResponseCodeClassifier::normalize(0));
        $this->assertSame('00', DigiflazzResponseCodeClassifier::normalize('0'));
        $this->assertSame('03', DigiflazzResponseCodeClassifier::normalize(3));
        $this->assertSame('03', DigiflazzResponseCodeClassifier::normalize('03'));
        $this->assertSame('99', DigiflazzResponseCodeClassifier::normalize(99));
    }

    public function test_to_log_context_has_required_fields_without_credentials(): void
    {
        $ctx = DigiflazzResponseCodeClassifier::classify('54')->toLogContext();

        $this->assertSame('54', $ctx['rc']);
        $this->assertSame(DigiflazzResponseCodeClassifier::VALIDATION, $ctx['category']);
        $this->assertSame('Gagal', $ctx['status']);
        $this->assertSame('Nomor Tujuan Salah', $ctx['message']);
        $this->assertTrue($ctx['transaction_created']);
        $this->assertArrayHasKey('deskripsi', $ctx);
        $this->assertArrayHasKey('retry', $ctx);
        $this->assertArrayHasKey('refund', $ctx);
        $this->assertArrayHasKey('transaction_created', $ctx);
        $this->assertArrayNotHasKey('api_key', $ctx);
        $this->assertArrayNotHasKey('username', $ctx);
        $this->assertArrayNotHasKey('secret', $ctx);
    }

    public function test_official_metadata_matches_pdf_columns(): void
    {
        $meta = DigiflazzResponseCodeClassifier::classify('00')->toOfficialMetadata();
        $this->assertSame([
            'rc' => '00',
            'message' => 'Transaksi Sukses',
            'status' => 'Sukses',
            'transaction_created' => true,
            'deskripsi' => '',
        ], $meta);

        $pending = DigiflazzResponseCodeClassifier::classify('03');
        $this->assertSame('Pending', $pending->officialStatus());
        $this->assertTrue($pending->transactionCreated());

        $payload = DigiflazzResponseCodeClassifier::classify('40');
        $this->assertSame('Gagal', $payload->officialStatus());
        $this->assertSame('Tipe data atau parameter tidak sesuai', $payload->deskripsi());
        $this->assertFalse($payload->transactionCreated());

        $rate = DigiflazzResponseCodeClassifier::classify('83');
        $this->assertTrue($rate->isRateLimited());
        $this->assertStringContainsString('5 menit', $rate->deskripsi());
        $this->assertFalse($rate->transactionCreated());
    }

    public function test_catalog_contains_all_required_official_rcs(): void
    {
        $required = [
            '00', '01', '02', '03',
            '40', '41', '42', '43', '44', '45', '47', '49',
            '50', '51', '52', '53', '54', '55', '56', '57', '58', '59',
            '60', '61', '62', '63', '64', '65', '66', '67', '68', '69',
            '70', '71', '72', '73', '74',
            '80', '81', '82', '83', '84', '85', '86', '87', '88',
            '99',
        ];

        $catalog = DigiflazzResponseCodeClassifier::catalog();
        foreach ($required as $rc) {
            $this->assertArrayHasKey($rc, $catalog, "Missing RC {$rc}");
            foreach ([
                'message', 'status', 'deskripsi', 'category', 'transaction_created', 'should_retry', 'should_refund',
                'permanent_failure', 'authentication_failure', 'validation_failure',
                'provider_failure', 'rate_limit',
            ] as $key) {
                $this->assertArrayHasKey($key, $catalog[$rc], "RC {$rc} missing {$key}");
            }

            $c = DigiflazzResponseCodeClassifier::classify($rc);
            $this->assertContains($c->officialStatus(), ['Sukses', 'Pending', 'Gagal'], "RC {$rc} status");
        }

        $this->assertTrue(DigiflazzResponseCodeClassifier::classify('56')->isDeprecated());
        $this->assertTrue(DigiflazzResponseCodeClassifier::classify('65')->isDeprecated());
        $this->assertSame('Deprecated', DigiflazzResponseCodeClassifier::classify('56')->deskripsi());
    }

    public function test_failover_policy_prefers_digiflazz_rc_over_message(): void
    {
        $policy = new ProviderFailoverPolicy;

        // Message looks customer, but RC 55 is provider issue → failover
        $this->assertTrue($policy->shouldFailover(
            'provider_rejected',
            'Nomor salah / tidak terdaftar',
            '55'
        ));

        // RC 54 validation → no failover even with provider-ish message
        $this->assertFalse($policy->shouldFailover(
            'provider_error',
            'timeout maintenance gangguan',
            '54'
        ));

        // RC 74 refund → no failover
        $this->assertFalse($policy->shouldFailover('digiflazz_refund', 'refund', '74'));

        // RC 41 auth → failover allowed (secondary provider may work)
        $this->assertTrue($policy->shouldFailover('authentication_failure', 'signature', '41'));
    }
}
