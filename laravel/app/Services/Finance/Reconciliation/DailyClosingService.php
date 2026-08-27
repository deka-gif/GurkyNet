<?php

namespace App\Services\Finance\Reconciliation;

use App\Enums\TransactionStatus;
use App\Enums\UserRole;
use App\Models\ReconciliationClosing;
use App\Models\ReconciliationIncident;
use App\Models\Transaction;
use App\Models\User;
use App\Models\WalletMutation;
use App\Models\WithdrawRequest;
use App\Services\NotificationService;
use App\Support\Finance\FinanceAudit;
use Illuminate\Support\Facades\Log;

/**
 * SRS 18.1 — daily closing snapshot + email Finance/Owner.
 */
class DailyClosingService
{
    public function __construct(
        protected NotificationService $notifications,
        protected InternalWalletReconciliationService $internal,
        protected ProviderDailyReconciliationService $providers,
        protected MidtransReconciliationService $midtrans
    ) {}

    public function run(?\DateTimeInterface $date = null): ReconciliationClosing
    {
        $day = \Illuminate\Support\Carbon::parse($date ?? now())->toDateString();

        // Ensure day's recon jobs produce records (idempotent).
        $internal = $this->internal->run();
        $provider = $this->providers->run(new \DateTimeImmutable($day));
        $mid = $this->midtrans->runDailySettlement(new \DateTimeImmutable($day));

        $openIncidents = ReconciliationIncident::query()
            ->where('status', ReconciliationIncident::STATUS_OPEN)
            ->get();

        $summary = [
            'date' => $day,
            'total_successful_transactions' => (float) Transaction::query()
                ->whereDate('updated_at', $day)
                ->where('status', TransactionStatus::SUCCESS->value)
                ->sum('total_payment'),
            'total_wallet_mutation' => (float) WalletMutation::query()->whereDate('created_at', $day)->sum('amount'),
            'total_deposit' => (float) WalletMutation::query()
                ->whereDate('created_at', $day)
                ->where('type', WalletMutation::TYPE_TOPUP)
                ->sum('amount'),
            'total_withdraw' => (float) abs((float) WalletMutation::query()
                ->whereDate('created_at', $day)
                ->where('type', WalletMutation::TYPE_HOLD)
                ->where('amount', '<', 0)
                ->sum('amount')),
            'total_refund' => (float) WalletMutation::query()
                ->whereDate('created_at', $day)
                ->where('type', WalletMutation::TYPE_REFUND)
                ->sum('amount'),
            'total_provider_variance' => collect($provider['incidents'] ?? [])->count(),
            'total_midtrans_variance' => collect($mid['incidents'] ?? [])->count(),
            'total_internal_variance' => (int) ($internal['mismatches'] ?? 0),
            'incidents_open' => $openIncidents->count(),
            'incidents' => $openIncidents->map(fn ($i) => [
                'code' => $i->incident_code,
                'type' => $i->type,
                'variance' => (float) $i->variance,
                'freeze_withdraw' => $i->freeze_withdraw,
            ])->values()->all(),
            'frozen_withdraw_active' => $openIncidents->where('freeze_withdraw', true)->count() > 0,
            'pending_withdraw_requests' => WithdrawRequest::query()->where('status', 'pending')->count(),
            'provider_items' => $provider['items'] ?? 0,
            'midtrans_items' => $mid['items'] ?? 0,
        ];

        $closing = ReconciliationClosing::query()->updateOrCreate(
            ['closing_date' => $day],
            ['summary' => $summary]
        );

        $emailed = $this->emailClosing($closing);
        if ($emailed) {
            $closing->update(['email_sent' => true]);
        }

        FinanceAudit::log(null, 'RECON_DAILY_CLOSING', [
            'closing_date' => $day,
            'email_sent' => $emailed,
        ]);

        return $closing->fresh();
    }

    protected function emailClosing(ReconciliationClosing $closing): bool
    {
        $summary = $closing->summary ?? [];
        $title = 'GurkyNet Daily Closing '.$closing->closing_date?->format('Y-m-d');
        $body = "Daily reconciliation closing\n"
            .json_encode($summary, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

        $recipients = User::query()
            ->whereIn('role', [UserRole::FINANCE->value, UserRole::OWNER->value, 'finance', 'owner'])
            ->get();

        $ok = false;
        foreach ($recipients as $user) {
            try {
                $this->notifications->send($user, $title, $body, 'recon_closing', ['email', 'database']);
                $ok = true;
            } catch (\Throwable $e) {
                Log::warning('Closing email failed', ['user_id' => $user->id, 'error' => $e->getMessage()]);
            }
        }

        return $ok;
    }
}
