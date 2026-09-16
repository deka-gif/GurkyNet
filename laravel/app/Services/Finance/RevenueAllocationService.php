<?php

namespace App\Services\Finance;

use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\FinanceAlert;
use App\Models\RevenueAllocationCategory;
use App\Models\RevenueAllocationEntry;
use App\Models\RevenueAllocationEntryLine;
use App\Models\RevenueAllocationRuleLine;
use App\Models\RevenueAllocationRuleSet;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * FR-FIN-10 — Alokasi otomatis admin_fee + margin ke kategori (%).
 *
 * allocable = max(0, transactions.admin_fee + Σ item.custom_metadata.margin)
 * Snapshot per SUCCESS; reverse on refund; skip+alert jika belum ada rule set.
 */
class RevenueAllocationService
{
    public function __construct(
        protected FinanceAlertService $alerts
    ) {}

    /**
     * Idempotent allocate after SUCCESS. Never throws to caller path — logs + skip.
     */
    public function allocateOnSuccess(Transaction $transaction): ?RevenueAllocationEntry
    {
        try {
            return DB::transaction(function () use ($transaction) {
                /** @var Transaction $locked */
                $locked = Transaction::query()
                    ->where('id', $transaction->id)
                    ->lockForUpdate()
                    ->with('items')
                    ->firstOrFail();

                $existing = RevenueAllocationEntry::query()
                    ->where('transaction_id', $locked->id)
                    ->lockForUpdate()
                    ->first();
                if ($existing) {
                    return $existing;
                }

                [$adminFee, $margin, $gross] = $this->computeAllocable($locked);

                $ruleSet = RevenueAllocationRuleSet::query()
                    ->where('is_current', true)
                    ->with(['lines.category'])
                    ->lockForUpdate()
                    ->first();

                if (! $ruleSet || $ruleSet->lines->isEmpty()) {
                    $entry = RevenueAllocationEntry::query()->create([
                        'transaction_id' => $locked->id,
                        'rule_set_id' => null,
                        'admin_fee_component' => $adminFee,
                        'margin_component' => $margin,
                        'gross_allocable' => $gross,
                        'status' => RevenueAllocationEntry::STATUS_SKIPPED,
                        'skip_reason' => 'no_current_rule_set',
                        'posted_at' => null,
                    ]);
                    $this->alertMissingRuleSet($locked, $entry);

                    return $entry;
                }

                $entry = RevenueAllocationEntry::query()->create([
                    'transaction_id' => $locked->id,
                    'rule_set_id' => $ruleSet->id,
                    'admin_fee_component' => $adminFee,
                    'margin_component' => $margin,
                    'gross_allocable' => $gross,
                    'status' => RevenueAllocationEntry::STATUS_POSTED,
                    'posted_at' => now(),
                ]);

                $amounts = $this->splitByPercentage($gross, $ruleSet->lines);
                foreach ($ruleSet->lines as $line) {
                    RevenueAllocationEntryLine::query()->create([
                        'entry_id' => $entry->id,
                        'category_id' => $line->category_id,
                        'percentage_snapshot' => (float) $line->percentage,
                        'amount' => $amounts[$line->category_id] ?? 0.0,
                    ]);
                }

                return $entry->fresh(['lines.category', 'ruleSet']);
            });
        } catch (\Throwable $e) {
            Log::error('FR-FIN-10 allocateOnSuccess failed', [
                'transaction_id' => $transaction->id,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Reverse posted allocation after refund / late-failure. Idempotent.
     */
    public function reverseOnRefund(Transaction $transaction, ?string $reason = null): ?RevenueAllocationEntry
    {
        try {
            return DB::transaction(function () use ($transaction, $reason) {
                $entry = RevenueAllocationEntry::query()
                    ->where('transaction_id', $transaction->id)
                    ->lockForUpdate()
                    ->first();

                if (! $entry) {
                    return null;
                }

                if ($entry->status === RevenueAllocationEntry::STATUS_REVERSED) {
                    return $entry;
                }

                if ($entry->status === RevenueAllocationEntry::STATUS_SKIPPED) {
                    return $entry;
                }

                $entry->update([
                    'status' => RevenueAllocationEntry::STATUS_REVERSED,
                    'reversed_at' => now(),
                    'reverse_reason' => $reason ?: 'transaction_refunded',
                    'refund_reference' => $transaction->refund_reference,
                ]);

                return $entry->fresh(['lines.category']);
            });
        } catch (\Throwable $e) {
            Log::error('FR-FIN-10 reverseOnRefund failed', [
                'transaction_id' => $transaction->id,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * @param  list<array{category_id:int,percentage:float|int|string}>  $lines
     */
    public function saveRuleSet(User $actor, array $lines, string $reason): RevenueAllocationRuleSet
    {
        if (! $this->actorMayManage($actor)) {
            throw ValidationException::withMessages([
                'role' => ['Hanya Finance yang dapat mengubah persentase alokasi pendapatan.'],
            ]);
        }

        $reason = trim($reason);
        if ($reason === '') {
            throw ValidationException::withMessages([
                'reason' => ['Alasan perubahan wajib diisi.'],
            ]);
        }

        if ($lines === []) {
            throw ValidationException::withMessages([
                'lines' => ['Minimal satu kategori dengan persentase harus dikirim.'],
            ]);
        }

        $normalized = [];
        $sum = 0.0;
        foreach ($lines as $idx => $line) {
            $catId = (int) ($line['category_id'] ?? 0);
            $pct = round((float) ($line['percentage'] ?? -1), 4);
            if ($catId <= 0) {
                throw ValidationException::withMessages([
                    "lines.$idx.category_id" => ['category_id tidak valid.'],
                ]);
            }
            if ($pct < 0 || $pct > 100) {
                throw ValidationException::withMessages([
                    "lines.$idx.percentage" => ['Persentase harus antara 0 dan 100.'],
                ]);
            }
            if (isset($normalized[$catId])) {
                throw ValidationException::withMessages([
                    "lines.$idx.category_id" => ['Kategori duplikat dalam rule set.'],
                ]);
            }
            $cat = RevenueAllocationCategory::query()->find($catId);
            if (! $cat) {
                // FR-FIN-10 — name the exact failing category_id (avoid generic 422).
                throw ValidationException::withMessages([
                    "lines.$idx.category_id" => [
                        "Kategori #{$catId} tidak ditemukan.",
                    ],
                ]);
            }
            if (! $cat->is_active) {
                throw ValidationException::withMessages([
                    "lines.$idx.category_id" => [
                        "Kategori \"{$cat->name}\" ({$cat->code}, id={$cat->id}) tidak aktif — hapus dari rule set atau aktifkan kembali sebelum menyimpan.",
                    ],
                ]);
            }
            $normalized[$catId] = $pct;
            $sum += $pct;
        }

        if (abs($sum - 100.0) > 0.01) {
            throw ValidationException::withMessages([
                'percentage' => [
                    'Total persentase harus 100% (saat ini '.rtrim(rtrim(number_format($sum, 4, '.', ''), '0'), '.').'%).',
                ],
            ]);
        }

        return DB::transaction(function () use ($actor, $normalized, $reason) {
            RevenueAllocationRuleSet::query()
                ->where('is_current', true)
                ->lockForUpdate()
                ->update(['is_current' => false]);

            $set = RevenueAllocationRuleSet::query()->create([
                'is_current' => true,
                'effective_from' => now(),
                'created_by' => $actor->id,
                'reason' => $reason,
            ]);

            foreach ($normalized as $catId => $pct) {
                RevenueAllocationRuleLine::query()->create([
                    'rule_set_id' => $set->id,
                    'category_id' => $catId,
                    'percentage' => $pct,
                ]);
            }

            ActivityLog::create([
                'user_id' => $actor->id,
                'activity' => 'REVENUE_ALLOCATION_RULE_UPDATED',
                'payload' => [
                    'rule_set_id' => $set->id,
                    'reason' => $reason,
                    'lines' => collect($normalized)->map(fn ($p, $id) => [
                        'category_id' => $id,
                        'percentage' => $p,
                    ])->values()->all(),
                ],
            ]);

            // Resolve open "missing rule set" alerts once Finance saves a valid set.
            FinanceAlert::query()
                ->where('type', 'revenue_allocation_rules_missing')
                ->where('status', 'open')
                ->update(['status' => 'resolved', 'resolved_at' => now()]);

            return $set->fresh(['lines.category', 'creator']);
        });
    }

    /**
     * @param  array{name:string,code?:string|null}  $payload
     */
    public function createCategory(User $actor, array $payload): RevenueAllocationCategory
    {
        if (! $this->actorMayManage($actor)) {
            throw ValidationException::withMessages([
                'role' => ['Hanya Finance yang dapat menambah kategori alokasi.'],
            ]);
        }

        $name = trim((string) ($payload['name'] ?? ''));
        if ($name === '') {
            throw ValidationException::withMessages(['name' => ['Nama kategori wajib.']]);
        }

        $code = Str::snake(trim((string) ($payload['code'] ?? $name)));
        $code = preg_replace('/[^a-z0-9_]+/', '_', strtolower($code)) ?: 'category';
        $code = substr($code, 0, 64);

        if (RevenueAllocationCategory::query()->where('code', $code)->exists()) {
            throw ValidationException::withMessages(['code' => ['Kode kategori sudah dipakai.']]);
        }

        $maxSort = (int) RevenueAllocationCategory::query()->max('sort_order');

        return RevenueAllocationCategory::query()->create([
            'code' => $code,
            'name' => $name,
            'sort_order' => $maxSort + 10,
            'is_active' => true,
        ]);
    }

    public function renameCategory(User $actor, int $categoryId, string $name): RevenueAllocationCategory
    {
        if (! $this->actorMayManage($actor)) {
            throw ValidationException::withMessages([
                'role' => ['Hanya Finance yang dapat mengubah nama kategori.'],
            ]);
        }
        $name = trim($name);
        if ($name === '') {
            throw ValidationException::withMessages(['name' => ['Nama kategori wajib.']]);
        }

        $cat = RevenueAllocationCategory::query()->findOrFail($categoryId);
        $cat->update(['name' => $name]);

        return $cat->fresh();
    }

    public function deactivateCategory(User $actor, int $categoryId): RevenueAllocationCategory
    {
        if (! $this->actorMayManage($actor)) {
            throw ValidationException::withMessages([
                'role' => ['Hanya Finance yang dapat menonaktifkan kategori.'],
            ]);
        }

        $cat = RevenueAllocationCategory::query()->findOrFail($categoryId);
        // Soft deactivate only — never hard-delete when history exists (and never hard-delete at all).
        $cat->update(['is_active' => false]);

        return $cat->fresh();
    }

    /**
     * @return array{categories: list<array<string,mixed>>, totals: array<int,float>, gross: float, from: string, to: string}
     */
    public function accumulation(?string $from, ?string $to): array
    {
        $fromDt = $from ? date('Y-m-d 00:00:00', strtotime($from)) : now()->startOfMonth()->toDateTimeString();
        $toDt = $to ? date('Y-m-d 23:59:59', strtotime($to)) : now()->endOfDay()->toDateTimeString();

        $rows = DB::table('revenue_allocation_entry_lines as l')
            ->join('revenue_allocation_entries as e', 'e.id', '=', 'l.entry_id')
            ->join('revenue_allocation_categories as c', 'c.id', '=', 'l.category_id')
            ->where('e.status', RevenueAllocationEntry::STATUS_POSTED)
            ->whereBetween('e.posted_at', [$fromDt, $toDt])
            ->groupBy('c.id', 'c.code', 'c.name', 'c.sort_order', 'c.is_active')
            ->orderBy('c.sort_order')
            ->selectRaw('c.id, c.code, c.name, c.sort_order, c.is_active, SUM(l.amount) as total_amount')
            ->get();

        $categories = [];
        $totals = [];
        $gross = 0.0;
        foreach ($rows as $r) {
            $amount = round((float) $r->total_amount, 2);
            $categories[] = [
                'id' => (int) $r->id,
                'code' => $r->code,
                'name' => $r->name,
                'sortOrder' => (int) $r->sort_order,
                'isActive' => (bool) $r->is_active,
                'totalAmount' => $amount,
            ];
            $totals[(int) $r->id] = $amount;
            $gross += $amount;
        }

        // Include active categories with zero for UI completeness.
        $active = RevenueAllocationCategory::query()->where('is_active', true)->orderBy('sort_order')->get();
        $seen = collect($categories)->pluck('id')->all();
        foreach ($active as $c) {
            if (! in_array($c->id, $seen, true)) {
                $categories[] = [
                    'id' => $c->id,
                    'code' => $c->code,
                    'name' => $c->name,
                    'sortOrder' => $c->sort_order,
                    'isActive' => true,
                    'totalAmount' => 0.0,
                ];
            }
        }
        usort($categories, fn ($a, $b) => $a['sortOrder'] <=> $b['sortOrder']);

        return [
            'categories' => $categories,
            'totals' => $totals,
            'gross' => round($gross, 2),
            'from' => $fromDt,
            'to' => $toDt,
        ];
    }

    public function currentRuleSetPayload(): array
    {
        $set = RevenueAllocationRuleSet::query()
            ->where('is_current', true)
            ->with(['lines.category', 'creator:id,name,email'])
            ->first();

        $categories = RevenueAllocationCategory::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->get()
            ->map(fn (RevenueAllocationCategory $c) => $this->categoryPayload($c))
            ->values()
            ->all();

        return [
            'categories' => $categories,
            'current' => $set ? $this->ruleSetPayload($set) : null,
        ];
    }

    public function historyPayload(int $limit = 30): array
    {
        $limit = max(1, min(100, $limit));
        $sets = RevenueAllocationRuleSet::query()
            ->with(['lines.category', 'creator:id,name,email'])
            ->orderByDesc('id')
            ->limit($limit)
            ->get();

        return $sets->map(fn (RevenueAllocationRuleSet $s) => $this->ruleSetPayload($s))->values()->all();
    }

    public function entryPayload(RevenueAllocationEntry $entry): array
    {
        $entry->loadMissing(['lines.category', 'ruleSet']);

        return [
            'id' => $entry->id,
            'transactionId' => $entry->transaction_id,
            'ruleSetId' => $entry->rule_set_id,
            'adminFeeComponent' => (float) $entry->admin_fee_component,
            'marginComponent' => (float) $entry->margin_component,
            'grossAllocable' => (float) $entry->gross_allocable,
            'status' => $entry->status,
            'skipReason' => $entry->skip_reason,
            'postedAt' => optional($entry->posted_at)?->toIso8601String(),
            'reversedAt' => optional($entry->reversed_at)?->toIso8601String(),
            'reverseReason' => $entry->reverse_reason,
            'refundReference' => $entry->refund_reference,
            'lines' => $entry->lines->map(fn (RevenueAllocationEntryLine $l) => [
                'categoryId' => $l->category_id,
                'categoryCode' => $l->category?->code,
                'categoryName' => $l->category?->name,
                'percentageSnapshot' => (float) $l->percentage_snapshot,
                'amount' => (float) $l->amount,
            ])->values()->all(),
        ];
    }

    public function actorMayManage(User $actor): bool
    {
        $role = $actor->role instanceof UserRole ? $actor->role : UserRole::tryFrom((string) $actor->role);

        return $role === UserRole::FINANCE || $role === UserRole::SUPER_ADMIN;
    }

    public function actorMayView(User $actor): bool
    {
        $role = $actor->role instanceof UserRole ? $actor->role : UserRole::tryFrom((string) $actor->role);

        return in_array($role, [
            UserRole::FINANCE,
            UserRole::OWNER,
            UserRole::SUPER_ADMIN,
        ], true);
    }

    /**
     * @return array{0: float, 1: float, 2: float} admin, margin, gross
     */
    public function computeAllocable(Transaction $tx): array
    {
        $admin = max(0.0, (float) $tx->admin_fee);
        $margin = 0.0;
        foreach ($tx->items ?? [] as $item) {
            $meta = is_array($item->custom_metadata)
                ? $item->custom_metadata
                : (is_string($item->custom_metadata) ? (json_decode($item->custom_metadata, true) ?: []) : []);
            $margin += max(0.0, (float) ($meta['margin'] ?? 0));
        }
        $gross = max(0.0, $admin + $margin);

        return [round($admin, 2), round($margin, 2), round($gross, 2)];
    }

    /**
     * @param  \Illuminate\Support\Collection<int, RevenueAllocationRuleLine>  $lines
     * @return array<int, float> category_id => amount
     */
    protected function splitByPercentage(float $gross, $lines): array
    {
        $result = [];
        if ($gross <= 0 || $lines->isEmpty()) {
            foreach ($lines as $line) {
                $result[$line->category_id] = 0.0;
            }

            return $result;
        }

        $allocated = 0.0;
        $indexed = $lines->values();
        $lastIdx = $indexed->count() - 1;
        foreach ($indexed as $i => $line) {
            $pct = (float) $line->percentage;
            if ($i === $lastIdx) {
                $amount = round($gross - $allocated, 2);
            } else {
                $amount = round($gross * ($pct / 100.0), 2);
                $allocated += $amount;
            }
            $result[$line->category_id] = $amount;
        }

        return $result;
    }

    protected function alertMissingRuleSet(Transaction $tx, RevenueAllocationEntry $entry): void
    {
        try {
            $this->alerts->raiseReconAlert(
                'revenue_allocation_rules_missing',
                'warning',
                'Rule set alokasi pendapatan belum tersedia',
                'Transaksi '.$tx->invoice_number.' SUCCESS tanpa rule set aktif — entry skipped. Segera isi persentase alokasi (total 100%).',
                [
                    'transaction_id' => $tx->id,
                    'invoice' => $tx->invoice_number,
                    'entry_id' => $entry->id,
                    'gross_allocable' => (float) $entry->gross_allocable,
                ],
                'transaction',
                $tx->id,
                ['finance', 'owner']
            );
        } catch (\Throwable $e) {
            Log::warning('FR-FIN-10 alert missing rule set failed', [
                'transaction_id' => $tx->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    protected function categoryPayload(RevenueAllocationCategory $c): array
    {
        return [
            'id' => $c->id,
            'code' => $c->code,
            'name' => $c->name,
            'sortOrder' => $c->sort_order,
            'isActive' => $c->is_active,
        ];
    }

    protected function ruleSetPayload(RevenueAllocationRuleSet $set): array
    {
        return [
            'id' => $set->id,
            'isCurrent' => (bool) $set->is_current,
            'effectiveFrom' => optional($set->effective_from)?->toIso8601String(),
            'reason' => $set->reason,
            'createdBy' => $set->created_by,
            'createdByName' => $set->creator?->name,
            'createdAt' => optional($set->created_at)?->toIso8601String(),
            'lines' => $set->lines->map(fn (RevenueAllocationRuleLine $l) => [
                'categoryId' => $l->category_id,
                'categoryCode' => $l->category?->code,
                'categoryName' => $l->category?->name,
                'categoryIsActive' => (bool) ($l->category?->is_active ?? false),
                'percentage' => (float) $l->percentage,
            ])->values()->all(),
            'totalPercentage' => round((float) $set->lines->sum('percentage'), 4),
        ];
    }
}
