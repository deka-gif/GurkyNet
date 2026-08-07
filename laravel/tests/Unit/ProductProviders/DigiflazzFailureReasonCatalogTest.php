<?php

namespace Tests\Unit\ProductProviders;

use App\Services\ProductProviders\DigiflazzFailureReasonCatalog;
use App\Services\ProductProviders\DigiflazzFailureReasonPresenter;
use App\Services\ProductProviders\DigiflazzResponseCodeClassifier;
use PHPUnit\Framework\TestCase;

class DigiflazzFailureReasonCatalogTest extends TestCase
{
    public function test_all_36_official_messages_are_recognized(): void
    {
        $messages = DigiflazzFailureReasonCatalog::officialMessages();
        $this->assertCount(36, $messages);

        foreach ($messages as $message) {
            $reason = DigiflazzFailureReasonCatalog::findByMessage($message);
            $this->assertNotNull($reason, "Missing: {$message}");
            $this->assertSame($message, $reason->description());
            $this->assertNotSame('', $reason->category());
            $this->assertNotSame('', $reason->userAction());
            $this->assertNotSame('', $reason->adminAction());
            $this->assertArrayHasKey('user_message', $reason->ux());
            $this->assertArrayHasKey('internal_message', $reason->ux());
        }
    }

    public function test_koneksi_belum_didukung_is_unknown_configuration(): void
    {
        $reason = DigiflazzFailureReasonCatalog::findByMessage('Koneksi belum didukung');

        $this->assertNotNull($reason);
        $this->assertNull($reason->relatedRc);
        $this->assertSame(DigiflazzFailureReasonCatalog::UNKNOWN_CONFIGURATION, $reason->category());
        $this->assertFalse($reason->shouldRetry());
        $this->assertFalse($reason->transactionCreated());
        $this->assertFalse($reason->allowsFailover());
        $this->assertStringContainsString('koneksi', strtolower($reason->adminAction()));
    }

    public function test_saldo_seller_digiflazz_habis_is_not_rc44(): void
    {
        $reason = DigiflazzFailureReasonCatalog::findByMessage('Saldo Seller Digiflazz Habis');

        $this->assertNotNull($reason);
        $this->assertNull($reason->relatedRc);
        $this->assertSame(DigiflazzFailureReasonCatalog::PROVIDER_SELLER_BALANCE, $reason->category());
        $this->assertTrue($reason->shouldRetry());
        $this->assertTrue($reason->transactionCreated());
        $this->assertTrue($reason->shouldRefund());
        $this->assertNotSame('44', $reason->relatedRc);
        $this->assertSame('provider_seller_balance', $reason->fulfillmentReason());
    }

    public function test_produk_gangguan_non_aktif_distinct_from_rc53_and_rc55(): void
    {
        $nonAktif = DigiflazzFailureReasonCatalog::findByMessage('Produk sedang Gangguan (Non Aktif)');
        $gangguan = DigiflazzFailureReasonCatalog::findByMessage('Produk Sedang Gangguan');

        $this->assertNotNull($nonAktif);
        $this->assertNotNull($gangguan);
        $this->assertNull($nonAktif->relatedRc);
        $this->assertSame('55', $gangguan->relatedRc);
        $this->assertFalse($nonAktif->transactionCreated());
        $this->assertTrue($gangguan->transactionCreated());
        $this->assertNotSame($nonAktif->message, $gangguan->message);
    }

    public function test_response_code_priority_over_message_for_transaction_created(): void
    {
        // Misleading message + RC 41 → transaction_created from RC (false), not from message catalog (Nomor Tujuan Salah = true).
        $created = DigiflazzFailureReasonCatalog::resolveTransactionCreated([
            'rc' => '41',
            'message' => 'Nomor Tujuan Salah',
        ]);
        $this->assertFalse($created);
        $this->assertFalse(DigiflazzResponseCodeClassifier::classify('41')->transactionCreated());

        $fromMessageOnly = DigiflazzFailureReasonCatalog::resolveTransactionCreated([
            'message' => 'Nomor Tujuan Salah',
        ]);
        $this->assertTrue($fromMessageOnly);
    }

    public function test_fallback_uses_catalog_when_rc_empty(): void
    {
        $reason = DigiflazzFailureReasonCatalog::findByMessage('Timeout Dari Biller');

        $this->assertNotNull($reason);
        $this->assertSame('70', $reason->relatedRc);
        $this->assertTrue($reason->shouldRetry());
        $this->assertTrue($reason->shouldRefund());
        $this->assertTrue($reason->transactionCreated());
    }

    public function test_refund_flags_follow_transaction_created_from_catalog(): void
    {
        $withTx = DigiflazzFailureReasonCatalog::findByMessage('Transaksi Refund');
        $withoutTx = DigiflazzFailureReasonCatalog::findByMessage('Invalid Payload');

        $this->assertTrue($withTx->transactionCreated());
        $this->assertTrue($withTx->shouldRefund());

        $this->assertFalse($withoutTx->transactionCreated());
        $this->assertFalse($withoutTx->shouldRefund());
    }

    public function test_retry_flags_from_catalog(): void
    {
        $this->assertTrue(DigiflazzFailureReasonCatalog::findByMessage('Produk Sedang Gangguan')->shouldRetry());
        $this->assertFalse(DigiflazzFailureReasonCatalog::findByMessage('Nomor Tujuan Salah')->shouldRetry());
        $this->assertTrue(DigiflazzFailureReasonCatalog::findByMessage('Saldo Seller Digiflazz Habis')->shouldRetry());
        $this->assertFalse(DigiflazzFailureReasonCatalog::findByMessage('Koneksi belum didukung')->shouldRetry());
    }

    public function test_presenter_prefers_rc_decision_source(): void
    {
        $presented = DigiflazzFailureReasonPresenter::present([
            'rc' => '54',
            'message' => 'Nomor Tujuan Salah',
        ]);

        $this->assertSame('response_code', $presented['decision_source']);
        $this->assertSame('54', $presented['rc']);
        $this->assertTrue($presented['transaction_created']);
    }

    public function test_presenter_falls_back_to_catalog_without_rc(): void
    {
        $presented = DigiflazzFailureReasonPresenter::present([
            'message' => 'Koneksi belum didukung',
        ]);

        $this->assertSame('failure_reason_catalog', $presented['decision_source']);
        $this->assertSame(DigiflazzFailureReasonCatalog::UNKNOWN_CONFIGURATION, $presented['category']);
        $this->assertArrayHasKey('user_action', DigiflazzFailureReasonPresenter::toLogContext([
            'message' => 'Koneksi belum didukung',
        ]));
    }

    public function test_case_insensitive_exact_match(): void
    {
        $reason = DigiflazzFailureReasonCatalog::findByMessage('nomor tujuan salah');
        $this->assertNotNull($reason);
        $this->assertSame('Nomor Tujuan Salah', $reason->message);
    }
}
