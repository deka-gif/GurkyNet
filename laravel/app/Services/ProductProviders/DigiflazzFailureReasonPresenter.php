<?php

namespace App\Services\ProductProviders;

/**
 * UX helper for Digiflazz failure reasons.
 * Does not alter API response contracts — for logs, admin UI, and internal notes only.
 */
final class DigiflazzFailureReasonPresenter
{
    /**
     * Build UX + audit context from Digiflazz `data` payload.
     * RC remains decision authority; catalog supplies UX / fallback metadata.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public static function present(array $data): array
    {
        $message = trim((string) ($data['message'] ?? ''));
        $rc = DigiflazzResponseCodeClassifier::normalize($data['rc'] ?? null);
        $catalog = DigiflazzFailureReasonCatalog::findByMessage($message)
            ?? DigiflazzFailureReasonCatalog::findByMessageFuzzy($message);

        $transactionCreated = DigiflazzFailureReasonCatalog::resolveTransactionCreated($data);

        if ($rc !== null) {
            $classifier = DigiflazzResponseCodeClassifier::classify($rc);
            $ux = $catalog?->ux() ?? [
                'internal_message' => 'Digiflazz RC '.$rc.': '.$classifier->description(),
                'user_message' => $message !== '' ? $message : $classifier->description(),
                'user_action' => 'Jika transaksi gagal dan saldo terpotong, hubungi layanan pelanggan.',
                'admin_action' => 'Tinjau RC '.$rc.' pada DigiflazzResponseCodeClassifier.',
            ];

            return array_merge($ux, [
                'decision_source' => 'response_code',
                'rc' => $rc,
                'failure_reason' => $catalog?->message ?? $classifier->description(),
                'related_rc' => $catalog?->relatedRc ?? $rc,
                'category' => $classifier->category,
                'transaction_created' => $transactionCreated,
                'retry' => $classifier->isRetryable(),
                'refund' => $classifier->isRefundable(),
                'user_action' => $ux['user_action'],
                'admin_action' => $ux['admin_action'],
            ]);
        }

        if ($catalog !== null) {
            $ux = $catalog->ux();

            return array_merge($ux, [
                'decision_source' => 'failure_reason_catalog',
                'rc' => null,
                'failure_reason' => $catalog->message,
                'related_rc' => $catalog->relatedRc,
                'category' => $catalog->category(),
                'transaction_created' => $transactionCreated,
                'retry' => $catalog->shouldRetry(),
                'refund' => $catalog->shouldRefund(),
                'user_action' => $ux['user_action'],
                'admin_action' => $ux['admin_action'],
            ]);
        }

        return [
            'decision_source' => 'unknown',
            'rc' => null,
            'failure_reason' => $message !== '' ? $message : null,
            'related_rc' => null,
            'category' => DigiflazzFailureReasonCatalog::UNKNOWN,
            'transaction_created' => false,
            'retry' => false,
            'refund' => false,
            'internal_message' => 'Digiflazz failure message not in Alasan Gagal catalog.',
            'user_message' => $message !== '' ? $message : 'Transaksi gagal.',
            'user_action' => 'Hubungi layanan pelanggan bila saldo terpotong.',
            'admin_action' => 'Periksa raw response Digiflazz; tambahkan mapping bila pesan resmi baru.',
        ];
    }

    /**
     * Log-safe subset (no credentials).
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public static function toLogContext(array $data): array
    {
        $presented = self::present($data);

        return [
            'failure_reason' => $presented['failure_reason'] ?? null,
            'related_rc' => $presented['related_rc'] ?? null,
            'decision_source' => $presented['decision_source'] ?? null,
            'category' => $presented['category'] ?? null,
            'transaction_created' => $presented['transaction_created'] ?? false,
            'retry' => $presented['retry'] ?? false,
            'refund' => $presented['refund'] ?? false,
            'user_action' => $presented['user_action'] ?? null,
            'admin_action' => $presented['admin_action'] ?? null,
        ];
    }
}
