<?php

namespace App\Services\Sla;

use App\Models\DepositRequest;
use App\Models\SupportTicket;
use App\Models\TicketReply;
use App\Models\User;
use App\Models\WithdrawRequest;
use Illuminate\Support\Carbon;

/**
 * FR-CS-03 / SRS Bagian 23 — SLA indicators (within | nearing | breached).
 */
class SlaEvaluationService
{
    public const WITHIN = 'within_sla';

    public const NEARING = 'nearing_sla';

    public const BREACHED = 'breached';

    public function __construct(protected BusinessHoursService $hours) {}

    /**
     * @return array{status:string,target_seconds:int,elapsed_seconds:int,deadline_at:?string,kind:string}
     */
    public function forSupportTicket(SupportTicket $ticket): array
    {
        $kind = $this->classifyTicket($ticket);
        $target = match ($kind) {
            'live_chat' => (int) config('sla.targets.live_chat_first_response_seconds'),
            'funds' => (int) config('sla.targets.funds_ticket_seconds'),
            default => (int) config('sla.targets.technical_ticket_seconds'),
        };

        $start = $ticket->created_at ?? now();
        $end = $ticket->resolved_at ?? $ticket->closed_at;

        if ($kind === 'live_chat') {
            $firstStaff = $this->firstStaffReplyAt($ticket);
            $end = $firstStaff ?? $end;
            if ($firstStaff === null && $end === null) {
                $end = null; // still open — measure to now
            }
        }

        return $this->evaluate($kind, $target, $start, $end);
    }

    /**
     * @return array{status:string,target_seconds:int,elapsed_seconds:int,deadline_at:?string,kind:string}
     */
    public function forDeposit(DepositRequest $deposit): array
    {
        $start = $deposit->created_at ?? now();
        $within = $this->hours->isWithinBusinessHours($start);
        $target = $within
            ? (int) config('sla.targets.deposit_within_hours_seconds')
            : (int) config('sla.targets.deposit_outside_hours_seconds');
        $end = $deposit->reviewed_at;

        return $this->evaluate($within ? 'deposit_within_hours' : 'deposit_outside_hours', $target, $start, $end);
    }

    /**
     * @return array{status:string,target_seconds:int,elapsed_seconds:int,deadline_at:?string,kind:string}
     */
    public function forWithdraw(WithdrawRequest $withdraw): array
    {
        $amount = (float) $withdraw->amount;
        $large = $amount >= (float) config('sla.withdraw_large_threshold', 10000000);
        $target = $large
            ? (int) config('sla.targets.withdraw_large_owner_seconds')
            : (int) config('sla.targets.withdraw_normal_seconds');
        $start = $withdraw->created_at ?? now();
        $end = $withdraw->reviewed_at;

        return $this->evaluate($large ? 'withdraw_large' : 'withdraw_normal', $target, $start, $end);
    }

    protected function classifyTicket(SupportTicket $ticket): string
    {
        $cat = strtolower((string) $ticket->category);
        $src = strtolower((string) ($ticket->source ?? ''));

        if (str_contains($cat, 'chat') || $src === 'chat' || $src === 'live_chat') {
            return 'live_chat';
        }
        if (
            str_contains($cat, 'refund')
            || str_contains($cat, 'dana')
            || str_contains($cat, 'saldo')
            || str_contains($cat, 'finance')
            || str_contains($cat, 'withdraw')
            || str_contains($cat, 'deposit')
        ) {
            return 'funds';
        }

        return 'technical';
    }

    protected function firstStaffReplyAt(SupportTicket $ticket): ?Carbon
    {
        $ticket->loadMissing('replies.user');
        foreach ($ticket->replies as $reply) {
            /** @var TicketReply $reply */
            $role = $reply->user?->role;
            $val = $role instanceof \App\Enums\UserRole ? $role->value : (string) $role;
            if (in_array(strtolower($val), ['customer_support', 'operations', 'finance', 'owner', 'super_admin'], true)) {
                return $reply->created_at ? Carbon::parse($reply->created_at) : null;
            }
        }

        return null;
    }

    /**
     * @return array{status:string,target_seconds:int,elapsed_seconds:int,deadline_at:?string,kind:string}
     */
    protected function evaluate(string $kind, int $targetSeconds, $start, $end): array
    {
        $startAt = Carbon::parse($start);
        $endAt = $end ? Carbon::parse($end) : now();
        $elapsed = (int) abs($startAt->diffInSeconds($endAt));
        $deadline = $startAt->copy()->addSeconds($targetSeconds);
        $remaining = $targetSeconds - $elapsed;
        $nearing = (float) config('sla.nearing_ratio', 0.2);

        if ($elapsed > $targetSeconds) {
            $status = self::BREACHED;
        } elseif ($remaining <= ($targetSeconds * $nearing)) {
            $status = self::NEARING;
        } else {
            $status = self::WITHIN;
        }

        return [
            'status' => $status,
            'target_seconds' => $targetSeconds,
            'elapsed_seconds' => $elapsed,
            'deadline_at' => $deadline->toIso8601String(),
            'kind' => $kind,
        ];
    }
}
