<?php

namespace App\Services\Finance\Reconciliation;

use App\Models\ReconciliationIncident;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletMutation;
use App\Services\Finance\FinanceAlertService;
use App\Support\Finance\FinanceAudit;
use Illuminate\Support\Facades\DB;

/**
 * SRS 18.2 — incident lifecycle + withdraw/purchase freeze gates.
 */
class ReconciliationIncidentService
{
    public function __construct(
        protected FinanceAlertService $alerts,
        protected ReconciliationConfig $config
    ) {}

    /**
     * Open or refresh an incident by fingerprint (no duplicate OPEN rows).
     *
     * @param  array<string, mixed>  $meta
     */
    public function openOrRefresh(array $data): ReconciliationIncident
    {
        $fingerprint = (string) $data['fingerprint'];
        $existing = ReconciliationIncident::query()
            ->where('fingerprint', $fingerprint)
            ->where('status', ReconciliationIncident::STATUS_OPEN)
            ->first();

        if ($existing) {
            $existing->update([
                'expected_amount' => $data['expected_amount'],
                'actual_amount' => $data['actual_amount'],
                'variance' => $data['variance'],
                'threshold' => $data['threshold'] ?? $this->config->threshold(),
                'meta' => array_merge($existing->meta ?? [], $data['meta'] ?? []),
                'notes' => $data['notes'] ?? $existing->notes,
            ]);

            return $existing->fresh();
        }

        $incident = ReconciliationIncident::create([
            'incident_code' => $this->nextCode(),
            'type' => $data['type'],
            'source' => $data['source'] ?? null,
            'user_id' => $data['user_id'] ?? null,
            'wallet_id' => $data['wallet_id'] ?? null,
            'expected_amount' => $data['expected_amount'],
            'actual_amount' => $data['actual_amount'],
            'variance' => $data['variance'],
            'threshold' => $data['threshold'] ?? $this->config->threshold(),
            'status' => ReconciliationIncident::STATUS_OPEN,
            'freeze_withdraw' => (bool) ($data['freeze_withdraw'] ?? false),
            'restrict_purchase' => (bool) ($data['restrict_purchase'] ?? false),
            'system_wide_freeze' => (bool) ($data['system_wide_freeze'] ?? false),
            'fingerprint' => $fingerprint,
            'meta' => $data['meta'] ?? null,
            'notes' => $data['notes'] ?? null,
            'detected_at' => now(),
        ]);

        $this->alerts->raiseReconAlert(
            'recon_'.$incident->type,
            abs((float) $incident->variance) >= (float) $incident->threshold ? 'critical' : 'warning',
            'Recon incident: '.$incident->incident_code,
            sprintf(
                '%s variance Rp %s (threshold Rp %s)',
                $incident->type,
                number_format(abs((float) $incident->variance), 0, ',', '.'),
                number_format((float) $incident->threshold, 0, ',', '.')
            ),
            [
                'incident_id' => $incident->id,
                'incident_code' => $incident->incident_code,
                'type' => $incident->type,
                'variance' => (float) $incident->variance,
                'freeze_withdraw' => $incident->freeze_withdraw,
            ],
            'reconciliation_incident',
            $incident->id,
            ['finance', 'owner']
        );

        FinanceAudit::log(null, 'RECON_INCIDENT_OPEN', [
            'incident_id' => $incident->id,
            'incident_code' => $incident->incident_code,
            'type' => $incident->type,
            'variance' => (float) $incident->variance,
            'freeze_withdraw' => $incident->freeze_withdraw,
            'restrict_purchase' => $incident->restrict_purchase,
        ]);

        return $incident;
    }

    public function resolve(ReconciliationIncident $incident, User $actor, ?string $notes = null): ReconciliationIncident
    {
        if ($incident->status === ReconciliationIncident::STATUS_RESOLVED) {
            return $incident;
        }

        $incident->update([
            'status' => ReconciliationIncident::STATUS_RESOLVED,
            'resolved_at' => now(),
            'resolved_by' => $actor->id,
            'notes' => trim(($incident->notes ? $incident->notes.' | ' : '').($notes ?: 'Resolved by Finance')),
            'freeze_withdraw' => false,
            'restrict_purchase' => false,
            'system_wide_freeze' => false,
        ]);

        FinanceAudit::log($actor, 'RECON_INCIDENT_RESOLVED', [
            'incident_id' => $incident->id,
            'incident_code' => $incident->incident_code,
        ]);

        return $incident->fresh();
    }

    public function isWithdrawFrozen(?int $userId): bool
    {
        $q = ReconciliationIncident::query()
            ->where('status', ReconciliationIncident::STATUS_OPEN)
            ->where('freeze_withdraw', true);

        return $q->where(function ($inner) use ($userId) {
            $inner->where('system_wide_freeze', true);
            if ($userId) {
                $inner->orWhere('user_id', $userId);
            }
        })->exists();
    }

    public function isPurchaseRestricted(int $userId): bool
    {
        return ReconciliationIncident::query()
            ->where('status', ReconciliationIncident::STATUS_OPEN)
            ->where('restrict_purchase', true)
            ->where('user_id', $userId)
            ->exists();
    }

    public function withdrawFreezeMessage(): string
    {
        return 'Penarikan dana sementara dihentikan karena ada reconciliation incident aktif (SRS Bagian 18). Hubungi Finance.';
    }

    public function purchaseRestrictMessage(): string
    {
        return 'Transaksi pembelian sementara dibatasi karena variance ledger wallet internal (SRS 18.2). Hubungi Finance.';
    }

    /**
     * Expected wallet balance from mutations (SRS 18.1).
     * Excludes Finance-approve TYPE_WITHDRAW markers that share a HOLD reference
     * (balance already moved on hold — ApproveWithdrawAction does not debit again).
     */
    public function expectedBalanceFromMutations(int $walletId): float
    {
        $sum = (float) WalletMutation::query()
            ->where('wallet_id', $walletId)
            ->where(function ($q) {
                $q->where('type', '!=', WalletMutation::TYPE_WITHDRAW)
                    ->orWhereNotExists(function ($sub) {
                        $sub->selectRaw('1')
                            ->from('wallet_mutations as holds')
                            ->whereColumn('holds.wallet_id', 'wallet_mutations.wallet_id')
                            ->whereColumn('holds.reference_id', 'wallet_mutations.reference_id')
                            ->where('holds.type', WalletMutation::TYPE_HOLD)
                            ->whereNotNull('holds.reference_id');
                    });
            })
            ->sum('amount');

        return round($sum, 2);
    }

    protected function nextCode(): string
    {
        return sprintf('RCI-%s-%04d', now()->format('YmdHis'), random_int(1000, 9999));
    }
}
