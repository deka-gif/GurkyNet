<?php

namespace App\Services\Wallet;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\Transaction;
use App\Models\TransactionItem;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletHistory;
use App\Models\WalletMutation;
use App\Models\WithdrawRequest;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/**
 * Customer monthly financial statement from wallet_mutations (authoritative ledger).
 *
 * FR / design: Customer Financial Statement audit — Phase 1 JSON only.
 * Does NOT use wallets.balance or wallet_histories for opening/income/expense/ending.
 * wallet_histories used only for customer-facing description text.
 */
class CustomerStatementService
{
    /** Map config hub keys → statement category_key used in API. */
    private const HUB_TO_CATEGORY_KEY = [
        'telekomunikasi' => 'telekomunikasi',
        'pembayaran-tagihan' => 'tagihan',
        'topup-digital' => 'e-wallet',
        'game' => 'game',
        'voucher-digital' => 'voucher-digital',
        'langganan-digital' => 'langganan',
        'international' => 'international',
    ];

    private const CATEGORY_LABELS = [
        'telekomunikasi' => 'Telekomunikasi',
        'tagihan' => 'Tagihan',
        'e-wallet' => 'E-Wallet',
        'game' => 'Game',
        'voucher-digital' => 'Voucher Digital',
        'langganan' => 'Langganan',
        'international' => 'International',
        'uang_masuk' => 'Uang Masuk',
        'refund' => 'Refund',
        'transfer_masuk' => 'Transfer Masuk',
        'transfer_keluar' => 'Transfer Keluar',
        'penarikan' => 'Penarikan',
        'penyesuaian' => 'Penyesuaian Saldo',
        'loyalitas' => 'Loyalitas',
        'komisi_referral' => 'Komisi Referral',
        'lainnya' => 'Lainnya',
    ];

    public function __construct(
        protected WalletMutationBalanceQuery $balanceQuery
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function build(User $user, Wallet $wallet, string $periodKey): array
    {
        [$start, $endExclusive, $periodMeta] = $this->resolvePeriod($periodKey);

        $opening = $this->balanceQuery->sumSigned(
            (int) $wallet->id,
            createdBeforeExclusive: $start
        );

        $flows = $this->balanceQuery->periodIncomeExpense(
            (int) $wallet->id,
            $start,
            $endExclusive
        );
        $income = $flows['income'];
        $expense = $flows['expense'];

        $ending = $this->balanceQuery->sumSigned(
            (int) $wallet->id,
            createdBeforeExclusive: $endExclusive
        );

        $expectedEnding = round($opening + $income - $expense, 2);
        if (abs($expectedEnding - $ending) >= 0.01) {
            throw new \RuntimeException(sprintf(
                'Statement invariant failed for wallet %d period %s: opening(%.2f)+income(%.2f)-expense(%.2f)=%.2f != ending(%.2f)',
                $wallet->id,
                $periodKey,
                $opening,
                $income,
                $expense,
                $expectedEnding,
                $ending
            ));
        }

        $mutations = $this->loadPeriodMutations((int) $wallet->id, $start, $endExclusive);
        $context = $this->buildEnrichmentContext($mutations);

        $mapped = [];
        foreach ($mutations as $mutation) {
            $mapped[] = $this->mapMutationRow($mutation, $context);
        }

        $incomeCategories = $this->aggregateCategoriesByDirection($mapped, 'credit');
        $expenseCategories = $this->aggregateCategoriesByDirection($mapped, 'debit');

        $incomeCatSum = round(array_sum(array_column($incomeCategories, 'amount')), 2);
        $expenseCatSum = round(array_sum(array_column($expenseCategories, 'amount')), 2);
        if (abs($incomeCatSum - $income) >= 0.01 || abs($expenseCatSum - $expense) >= 0.01) {
            throw new \RuntimeException(sprintf(
                'Statement category breakdown mismatch for wallet %d period %s: income %.2f vs cats %.2f; expense %.2f vs cats %.2f',
                $wallet->id,
                $periodKey,
                $income,
                $incomeCatSum,
                $expense,
                $expenseCatSum
            ));
        }

        $gurkyPayId = $user->gurky_pay_id ?: $wallet->wallet_number;

        return [
            'period' => $periodMeta,
            'currency' => 'IDR',
            'account' => [
                'name' => (string) $user->name,
                'gurky_pay_id' => (string) $gurkyPayId,
            ],
            'opening_balance' => $opening,
            'income' => $income,
            'expense' => $expense,
            'ending_balance' => $ending,
            'income_categories' => $incomeCategories,
            'expense_categories' => $expenseCategories,
            'mutations' => $mapped,
        ];
    }

    /**
     * Validate YYYY-MM and reject future months (app timezone).
     *
     * @return array{0: Carbon, 1: Carbon, 2: array<string, string>}
     */
    public function resolvePeriod(string $periodKey): array
    {
        if (! preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $periodKey)) {
            throw ValidationException::withMessages([
                'period' => ['Format periode harus YYYY-MM (contoh: 2026-09).'],
            ]);
        }

        $tz = (string) config('app.timezone', 'Asia/Jakarta');
        $start = Carbon::createFromFormat('Y-m-d H:i:s', $periodKey.'-01 00:00:00', $tz);
        if ($start === false) {
            throw ValidationException::withMessages([
                'period' => ['Periode tidak valid.'],
            ]);
        }
        $start = $start->startOfMonth();
        $endExclusive = $start->copy()->addMonth();

        $currentMonthStart = Carbon::now($tz)->startOfMonth();
        if ($start->greaterThan($currentMonthStart)) {
            throw ValidationException::withMessages([
                'period' => ['Periode masa depan belum tersedia.'],
            ]);
        }

        $endInclusiveDate = $endExclusive->copy()->subDay()->toDateString();

        return [
            $start,
            $endExclusive,
            [
                'key' => $periodKey,
                'start' => $start->toDateString(),
                'end' => $endInclusiveDate,
                'timezone' => $tz,
            ],
        ];
    }

    /**
     * Attachment filename — no user/db ids.
     */
    public function pdfFilename(string $periodKey): string
    {
        return 'GurkyPay-Laporan-Keuangan-'.$periodKey.'.pdf';
    }

    /**
     * Human period line for PDF presentation (Indonesian months).
     *
     * @param  array<string, mixed>  $statement
     */
    public function formatPeriodLabel(array $statement): string
    {
        $start = (string) ($statement['period']['start'] ?? '');
        $end = (string) ($statement['period']['end'] ?? '');
        $tz = (string) ($statement['period']['timezone'] ?? config('app.timezone', 'Asia/Jakarta'));

        $startC = Carbon::parse($start, $tz);
        $endC = Carbon::parse($end, $tz);

        return sprintf(
            '%d %s %d — %d %s %d',
            (int) $startC->day,
            $this->indonesianMonthName((int) $startC->month),
            (int) $startC->year,
            (int) $endC->day,
            $this->indonesianMonthName((int) $endC->month),
            (int) $endC->year
        );
    }

    public function indonesianMonthName(int $month): string
    {
        $names = [
            1 => 'Januari',
            2 => 'Februari',
            3 => 'Maret',
            4 => 'April',
            5 => 'Mei',
            6 => 'Juni',
            7 => 'Juli',
            8 => 'Agustus',
            9 => 'September',
            10 => 'Oktober',
            11 => 'November',
            12 => 'Desember',
        ];

        return $names[$month] ?? '';
    }

    /**
     * @return Collection<int, WalletMutation>
     */
    protected function loadPeriodMutations(int $walletId, Carbon $start, Carbon $endExclusive): Collection
    {
        $query = WalletMutation::query()->orderBy('created_at')->orderBy('id');
        $this->balanceQuery->forWallet($query, $walletId);
        $this->balanceQuery->applyBalanceAffectingFilter($query);
        $this->balanceQuery->createdInHalfOpen($query, $start, $endExclusive);

        return $query->get();
    }

    /**
     * Batch-load transactions / items / products / histories / withdraw refs.
     *
     * @param  Collection<int, WalletMutation>  $mutations
     * @return array{
     *   transactions: Collection<string, Transaction>,
     *   itemsByTx: Collection<int, Collection<int, TransactionItem>>,
     *   productsBySku: Collection<string, Product>,
     *   categoriesById: Collection<int, ProductCategory>,
     *   historiesByRef: Collection<string, Collection<int, WalletHistory>>,
     *   withdrawTxIds: array<int, true>
     * }
     */
    protected function buildEnrichmentContext(Collection $mutations): array
    {
        $refs = $mutations
            ->pluck('reference_id')
            ->filter(fn ($r) => $r !== null && $r !== '')
            ->unique()
            ->values();

        $txIds = $refs
            ->filter(fn ($r) => ctype_digit((string) $r))
            ->map(fn ($r) => (int) $r)
            ->unique()
            ->values();

        $transactions = $txIds->isEmpty()
            ? collect()
            : Transaction::query()
                ->whereIn('id', $txIds->all())
                ->get()
                ->keyBy(fn (Transaction $t) => (string) $t->id);

        $items = $txIds->isEmpty()
            ? collect()
            : TransactionItem::query()
                ->whereIn('transaction_id', $txIds->all())
                ->get();

        $itemsByTx = $items->groupBy('transaction_id');

        $skus = $items->pluck('product_code')->filter()->unique()->values();
        $products = $skus->isEmpty()
            ? collect()
            : Product::query()
                ->whereIn('sku_code', $skus->all())
                ->get()
                ->keyBy('sku_code');

        $categoryIds = $products->pluck('product_category_id')->filter()->unique()->values();
        $categoriesById = $categoryIds->isEmpty()
            ? collect()
            : ProductCategory::query()
                ->whereIn('id', $categoryIds->all())
                ->get()
                ->keyBy('id');

        $walletId = (int) $mutations->first()?->wallet_id;
        $historiesByRef = collect();
        if ($walletId > 0 && $refs->isNotEmpty()) {
            $historiesByRef = WalletHistory::query()
                ->where('wallet_id', $walletId)
                ->whereIn('reference_id', $refs->all())
                ->orderBy('id')
                ->get()
                ->groupBy(fn (WalletHistory $h) => (string) $h->reference_id);
        }

        $withdrawTxIds = [];
        if ($txIds->isNotEmpty()) {
            $withdrawTxIds = WithdrawRequest::query()
                ->whereIn('transaction_id', $txIds->all())
                ->pluck('transaction_id')
                ->mapWithKeys(fn ($id) => [(int) $id => true])
                ->all();
        }

        return [
            'transactions' => $transactions,
            'itemsByTx' => $itemsByTx,
            'productsBySku' => $products,
            'categoriesById' => $categoriesById,
            'historiesByRef' => $historiesByRef,
            'withdrawTxIds' => $withdrawTxIds,
        ];
    }

    /**
     * @param  array{
     *   transactions: Collection<string, Transaction>,
     *   itemsByTx: Collection<int, Collection<int, TransactionItem>>,
     *   productsBySku: Collection<string, Product>,
     *   categoriesById: Collection<int, ProductCategory>,
     *   historiesByRef: Collection<string, Collection<int, WalletHistory>>,
     *   withdrawTxIds: array<int, true>
     * }  $context
     * @return array<string, mixed>
     */
    protected function mapMutationRow(WalletMutation $mutation, array $context): array
    {
        $amountSigned = (float) $mutation->amount;
        $direction = $amountSigned < 0 ? 'debit' : 'credit';
        $amountAbs = round(abs($amountSigned), 2);

        $description = $this->sanitizeCustomerDescription(
            $mutation,
            $this->resolveDescription($mutation, $context)
        );
        $category = $this->resolveCategory($mutation, $context, $description);

        return [
            'id' => (int) $mutation->id,
            'occurred_at' => optional($mutation->created_at)?->toIso8601String(),
            'ledger_type' => (string) $mutation->type,
            'direction' => $direction,
            'amount' => $amountAbs,
            'description' => $description,
            'category_key' => $category['key'],
            'category_label' => $category['label'],
            'reference_id' => $mutation->reference_id !== null ? (string) $mutation->reference_id : null,
            'affects_balance' => true,
        ];
    }

    /**
     * Customer-facing description only — never mutate ledger rows.
     */
    protected function sanitizeCustomerDescription(WalletMutation $mutation, string $raw): string
    {
        if ($mutation->type === WalletMutation::TYPE_ADJUSTMENT
            || preg_match('/^Adjustment\s*\(/i', $raw)
            || preg_match('/^Adjustment:/i', $raw)
        ) {
            return 'Penyesuaian Saldo';
        }

        $clean = $raw;

        // Strip common internal/provider leakage (case-insensitive).
        $patterns = [
            '/\bDigiflazz\b/iu',
            '/\bVIP\s*Payment\b/iu',
            '/\bVIPayment\b/iu',
            '/\bVipayment\b/iu',
            '/\bMidtrans\b/iu',
            '/\bdummy[_\s-]?gateway\b/iu',
            '/\bserver[_\s-]?key\b/iu',
            '/\bprovider\s*cost\b/iu',
            '/\bmargin\b/iu',
        ];
        foreach ($patterns as $pattern) {
            $clean = preg_replace($pattern, '', $clean) ?? $clean;
        }

        $clean = preg_replace('/\s{2,}/', ' ', trim($clean)) ?? trim($clean);
        $clean = trim($clean, " \t\n\r\0\x0B-–—|:");

        if ($clean === '') {
            return match ($mutation->type) {
                WalletMutation::TYPE_TOPUP => 'Top Up Saldo',
                WalletMutation::TYPE_REFUND => 'Refund',
                WalletMutation::TYPE_HOLD => 'Pembelian',
                WalletMutation::TYPE_WITHDRAW => 'Transfer Keluar',
                WalletMutation::TYPE_LOYALTY_REDEEM => 'Penukaran poin',
                WalletMutation::TYPE_REFERRAL_COMMISSION => 'Komisi referral',
                default => 'Mutasi wallet',
            };
        }

        return $clean;
    }

    /**
     * @param  array<string, mixed>  $context
     */
    protected function resolveDescription(WalletMutation $mutation, array $context): string
    {
        $ref = $mutation->reference_id !== null ? (string) $mutation->reference_id : '';
        /** @var Collection<int, WalletHistory>|null $histories */
        $histories = $ref !== '' ? ($context['historiesByRef']->get($ref) ?? collect()) : collect();

        $abs = abs((float) $mutation->amount);
        $wantCredit = (float) $mutation->amount >= 0;

        $match = $histories->first(function (WalletHistory $h) use ($abs, $wantCredit) {
            $dirOk = $wantCredit
                ? $h->type === 'credit'
                : $h->type === 'debit';

            return $dirOk && abs((float) $h->amount - $abs) < 0.01;
        });

        if ($match && is_string($match->description) && $match->description !== '') {
            return $match->description;
        }

        if ($histories->isNotEmpty() && is_string($histories->last()->description)) {
            return (string) $histories->last()->description;
        }

        return match ($mutation->type) {
            WalletMutation::TYPE_TOPUP => 'Top Up Saldo',
            WalletMutation::TYPE_REFUND => 'Refund',
            WalletMutation::TYPE_HOLD => 'Pembelian',
            WalletMutation::TYPE_WITHDRAW => 'Transfer Keluar',
            WalletMutation::TYPE_ADJUSTMENT => 'Penyesuaian Saldo',
            WalletMutation::TYPE_LOYALTY_REDEEM => 'Penukaran poin',
            WalletMutation::TYPE_REFERRAL_COMMISSION => 'Komisi referral',
            default => 'Mutasi wallet',
        };
    }

    /**
     * @param  array<string, mixed>  $context
     * @return array{key: string, label: string}
     */
    protected function resolveCategory(WalletMutation $mutation, array $context, string $description): array
    {
        $type = $mutation->type;

        if ($type === WalletMutation::TYPE_TOPUP) {
            if (str_starts_with(mb_strtolower($description), 'transfer masuk')) {
                return $this->categoryPair('transfer_masuk');
            }

            return $this->categoryPair('uang_masuk');
        }

        if ($type === WalletMutation::TYPE_REFUND) {
            return $this->categoryPair('refund');
        }

        if ($type === WalletMutation::TYPE_LOYALTY_REDEEM) {
            return $this->categoryPair('loyalitas');
        }

        if ($type === WalletMutation::TYPE_REFERRAL_COMMISSION) {
            return $this->categoryPair('komisi_referral');
        }

        if ($type === WalletMutation::TYPE_ADJUSTMENT) {
            return $this->categoryPair('penyesuaian');
        }

        if ($type === WalletMutation::TYPE_WITHDRAW) {
            return $this->categoryPair('transfer_keluar');
        }

        if ($type === WalletMutation::TYPE_HOLD) {
            $ref = $mutation->reference_id !== null ? (string) $mutation->reference_id : '';
            $txId = ctype_digit($ref) ? (int) $ref : null;

            if ($txId !== null && isset($context['withdrawTxIds'][$txId])) {
                return $this->categoryPair('penarikan');
            }

            if (str_contains(mb_strtolower($description), 'hold withdraw')
                || str_contains(mb_strtolower($description), 'penarikan')) {
                return $this->categoryPair('penarikan');
            }

            $productCategory = $this->resolveProductCategoryKey($txId, $context);
            if ($productCategory !== null) {
                return $productCategory;
            }

            return $this->categoryPair('lainnya');
        }

        return $this->categoryPair('lainnya');
    }

    /**
     * @param  array<string, mixed>  $context
     * @return array{key: string, label: string}|null
     */
    protected function resolveProductCategoryKey(?int $txId, array $context): ?array
    {
        if ($txId === null) {
            return null;
        }

        /** @var Collection<int, TransactionItem>|null $items */
        $items = $context['itemsByTx']->get($txId);
        if (! $items || $items->isEmpty()) {
            return null;
        }

        foreach ($items as $item) {
            $sku = (string) ($item->product_code ?? '');
            if ($sku === '') {
                continue;
            }
            /** @var Product|null $product */
            $product = $context['productsBySku']->get($sku);
            if (! $product || ! $product->product_category_id) {
                continue;
            }
            /** @var ProductCategory|null $category */
            $category = $context['categoriesById']->get((int) $product->product_category_id);
            if (! $category) {
                continue;
            }

            $slug = (string) $category->slug;
            $hub = config('gurky_catalog.categories.'.$slug.'.hub');
            if (is_string($hub) && $hub !== '' && isset(self::HUB_TO_CATEGORY_KEY[$hub])) {
                return $this->categoryPair(self::HUB_TO_CATEGORY_KEY[$hub]);
            }

            // Metadata flags on item when category hub unknown
            $meta = is_array($item->custom_metadata) ? $item->custom_metadata : [];
            if (! empty($meta['is_ewallet'])) {
                return $this->categoryPair('e-wallet');
            }
            if (! empty($meta['is_game'])) {
                return $this->categoryPair('game');
            }
            if (! empty($meta['pln_prepaid']) || ! empty($meta['is_pln'])) {
                return $this->categoryPair('tagihan');
            }
        }

        return null;
    }

    /**
     * @return array{key: string, label: string}
     */
    protected function categoryPair(string $key): array
    {
        return [
            'key' => $key,
            'label' => self::CATEGORY_LABELS[$key] ?? self::CATEGORY_LABELS['lainnya'],
        ];
    }

    /**
     * Split category totals by money direction — credit → income, debit → expense.
     * A mutation never appears on both sides.
     *
     * @param  list<array<string, mixed>>  $mapped
     * @param  'credit'|'debit'  $direction
     * @return list<array{key: string, label: string, amount: float}>
     */
    protected function aggregateCategoriesByDirection(array $mapped, string $direction): array
    {
        $totals = [];
        $labels = [];

        foreach ($mapped as $row) {
            if (($row['direction'] ?? '') !== $direction) {
                continue;
            }
            $key = (string) $row['category_key'];
            $amount = (float) $row['amount'];
            if (! isset($totals[$key])) {
                $totals[$key] = 0.0;
                $labels[$key] = (string) ($row['category_label']
                    ?? self::CATEGORY_LABELS[$key]
                    ?? self::CATEGORY_LABELS['lainnya']);
            }
            $totals[$key] = round($totals[$key] + $amount, 2);
        }

        $out = [];
        foreach ($totals as $key => $amount) {
            if ($amount <= 0) {
                continue;
            }
            $out[] = [
                'key' => $key,
                'label' => $labels[$key] ?? (self::CATEGORY_LABELS[$key] ?? self::CATEGORY_LABELS['lainnya']),
                'amount' => $amount,
            ];
        }

        usort($out, fn ($a, $b) => $b['amount'] <=> $a['amount']);

        return $out;
    }
}
