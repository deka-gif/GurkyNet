<?php

namespace App\Services\Finance;

use App\Enums\TransactionStatus;
use App\Models\FinanceLedgerEntry;
use App\Models\FinanceSettlement;
use App\Models\Transaction;
use App\Models\TransactionItem;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Response;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\StreamedResponse;

class FinanceReportService
{
    /**
     * FR-FIN-08 — resolve daily/weekly/monthly (or explicit dates) to start/end.
     *
     * @return array{start_date: string, end_date: string, period_label: string}
     */
    public function resolvePeriodFilters(?string $period, ?string $startDate = null, ?string $endDate = null): array
    {
        if ($startDate && $endDate) {
            return [
                'start_date' => $startDate,
                'end_date' => $endDate,
                'period_label' => 'custom',
            ];
        }

        $period = $period ?: 'monthly';
        $end = now()->toDateString();
        $start = match ($period) {
            'daily' => now()->toDateString(),
            'weekly' => now()->subDays(6)->toDateString(),
            default => now()->startOfMonth()->toDateString(),
        };

        return [
            'start_date' => $start,
            'end_date' => $end,
            'period_label' => $period,
        ];
    }

    /**
     * Structured financial report from real DB aggregates (no dummy series).
     * FR-FIN-08 — omzet, L/R, biaya operasional dari data tersedia (tanpa angka fiktif).
     *
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    public function generate(array $filters = []): array
    {
        $start = $filters['start_date'] ?? now()->startOfMonth()->toDateString();
        $end = $filters['end_date'] ?? now()->toDateString();

        $txQ = Transaction::query()->whereDate('created_at', '>=', $start)->whereDate('created_at', '<=', $end);
        $success = (clone $txQ)->whereIn('status', [TransactionStatus::SUCCESS->value, 'sukses', 'success']);

        $revenue = (float) (clone $success)->sum('total_payment');
        $refundCost = (float) FinanceLedgerEntry::query()
            ->whereIn('event_type', ['wallet_refund', 'refund_approve'])
            ->whereDate('created_at', '>=', $start)
            ->whereDate('created_at', '<=', $end)
            ->sum('credit');
        // Fallback if ledger empty for period
        if ($refundCost <= 0) {
            $refundCost = (float) Transaction::query()
                ->whereNotNull('refunded_at')
                ->whereDate('refunded_at', '>=', $start)
                ->whereDate('refunded_at', '<=', $end)
                ->sum('total_payment');
        }

        $settlementTotal = (float) FinanceSettlement::query()
            ->where('status', 'completed')
            ->whereDate('completed_at', '>=', $start)
            ->whereDate('completed_at', '<=', $end)
            ->sum('amount');

        $adjustments = (float) FinanceLedgerEntry::query()
            ->whereIn('event_type', ['manual_adjustment', 'admin_override'])
            ->whereDate('created_at', '>=', $start)
            ->whereDate('created_at', '<=', $end)
            ->selectRaw('SUM(credit - debit) as net')
            ->value('net');

        $items = TransactionItem::query()
            ->whereHas('transaction', function ($q) use ($start, $end) {
                $q->whereDate('created_at', '>=', $start)
                    ->whereDate('created_at', '<=', $end)
                    ->whereIn('status', [TransactionStatus::SUCCESS->value, 'sukses', 'success']);
            })
            ->get();

        $providerCost = 0.0;
        $margin = 0.0;
        foreach ($items as $item) {
            $meta = is_array($item->custom_metadata ?? null)
                ? $item->custom_metadata
                : (is_string($item->custom_metadata ?? null) ? (json_decode($item->custom_metadata, true) ?: []) : []);
            $base = (float) ($meta['base_price'] ?? $meta['provider_price'] ?? 0);
            $sell = (float) ($item->price ?? $item->subtotal ?? 0);
            if ($base > 0) {
                $providerCost += $base;
            }
            if ($sell > 0 && $base > 0) {
                $margin += ($sell - $base);
            }
        }

        $gatewayFee = (float) (clone $success)->sum('admin_fee');
        $expense = $providerCost + $refundCost + $gatewayFee;
        $netProfit = $revenue - $expense;

        $topups = (float) FinanceLedgerEntry::query()
            ->where('event_type', 'wallet_topup')
            ->whereDate('created_at', '>=', $start)
            ->whereDate('created_at', '<=', $end)
            ->sum('credit');

        return [
            'period' => ['start' => $start, 'end' => $end],
            'incomeStatement' => [
                'revenue' => $revenue,
                'providerCost' => $providerCost,
                'gatewayFee' => $gatewayFee,
                'refundCost' => $refundCost,
                'grossProfit' => $revenue - $providerCost,
                'netProfit' => $netProfit,
            ],
            'profitLoss' => [
                'revenue' => $revenue,
                'expenses' => $expense,
                'net' => $netProfit,
                'margin' => $margin,
            ],
            'cashFlow' => [
                'inflowTopup' => $topups,
                'inflowSettlement' => $settlementTotal,
                'outflowRefunds' => $refundCost,
                'netAdjustments' => (float) $adjustments,
            ],
            'margin' => [
                'estimated' => $margin,
                'revenue' => $revenue,
                'providerCost' => $providerCost,
            ],
            'gatewayFee' => $gatewayFee,
            'providerCost' => $providerCost,
            'refundCost' => $refundCost,
            'settlement' => $settlementTotal,
            'tax' => app(\App\Services\Tax\TaxScaffoldService::class)->reportScaffold(),
            'operationalCosts' => [
                'providerCost' => $providerCost,
                'gatewayFee' => $gatewayFee,
                'refundCost' => $refundCost,
                'total' => $expense,
                'note' => 'Biaya operasional dihitung dari biaya provider + admin fee gateway + refund; tidak ada akun opex terpisah di schema saat ini.',
            ],
            'profitLossByCategory' => $this->profitLossByCategory($start, $end),
            'omzet' => $revenue,
            'period_label' => $filters['period_label'] ?? null,
            'growth' => $this->growth($start, $end, $revenue),
        ];
    }

    /**
     * @return list<array{category: string, revenue: float, cost: float, profit: float}>
     */
    protected function profitLossByCategory(string $start, string $end): array
    {
        $items = TransactionItem::query()
            ->with(['transaction'])
            ->whereHas('transaction', function ($q) use ($start, $end) {
                $q->whereDate('created_at', '>=', $start)
                    ->whereDate('created_at', '<=', $end)
                    ->whereIn('status', [TransactionStatus::SUCCESS->value, 'sukses', 'success']);
            })
            ->get();

        $buckets = [];
        foreach ($items as $item) {
            $meta = is_array($item->custom_metadata ?? null)
                ? $item->custom_metadata
                : (is_string($item->custom_metadata ?? null) ? (json_decode($item->custom_metadata, true) ?: []) : []);
            $category = (string) ($meta['category'] ?? $meta['provider'] ?? $item->product_name ?? 'Lainnya');
            $base = (float) ($meta['base_price'] ?? $meta['provider_price'] ?? 0);
            $sell = (float) ($item->price ?? $item->subtotal ?? 0);
            if (!isset($buckets[$category])) {
                $buckets[$category] = ['category' => $category, 'revenue' => 0.0, 'cost' => 0.0, 'profit' => 0.0];
            }
            $buckets[$category]['revenue'] += $sell;
            $buckets[$category]['cost'] += $base;
            $buckets[$category]['profit'] += ($sell - $base);
        }

        return array_values($buckets);
    }

    public function exportExcel(array $report): StreamedResponse
    {
        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Laporan Keuangan');
        $sheet->fromArray([
            ['GurkyNet — Laporan Keuangan (FR-FIN-08)'],
            ['Periode', ($report['period']['start'] ?? '').' s/d '.($report['period']['end'] ?? '')],
            [],
            ['Omzet (Revenue)', $report['omzet'] ?? $report['incomeStatement']['revenue'] ?? 0],
            ['Provider Cost', $report['providerCost'] ?? 0],
            ['Gateway Fee', $report['gatewayFee'] ?? 0],
            ['Refund Cost', $report['refundCost'] ?? 0],
            ['Biaya Operasional Total', $report['operationalCosts']['total'] ?? 0],
            ['Laba Bersih', $report['incomeStatement']['netProfit'] ?? 0],
            [],
            ['Kategori', 'Omzet', 'Cost', 'Laba'],
        ], null, 'A1');

        $row = 12;
        foreach ($report['profitLossByCategory'] ?? [] as $cat) {
            $sheet->fromArray([
                [$cat['category'], $cat['revenue'], $cat['cost'], $cat['profit']],
            ], null, 'A'.$row);
            $row++;
        }

        $filename = 'laporan-keuangan-'.($report['period']['start'] ?? 'start').'-'.($report['period']['end'] ?? 'end').'.xlsx';

        return response()->streamDownload(function () use ($spreadsheet) {
            $writer = new Xlsx($spreadsheet);
            $writer->save('php://output');
        }, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
    }

    public function exportPdf(array $report): StreamedResponse
    {
        $html = view('finance.report-pdf', ['report' => $report])->render();
        $pdf = Pdf::loadHTML($html);
        $filename = 'laporan-keuangan-'.($report['period']['start'] ?? 'start').'-'.($report['period']['end'] ?? 'end').'.pdf';

        return response()->streamDownload(function () use ($pdf) {
            echo $pdf->output();
        }, $filename, [
            'Content-Type' => 'application/pdf',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    protected function growth(string $start, string $end, float $revenue): array
    {
        $startDt = \Carbon\Carbon::parse($start);
        $endDt = \Carbon\Carbon::parse($end);
        $days = max(1, $startDt->diffInDays($endDt) + 1);
        $prevEnd = $startDt->copy()->subDay();
        $prevStart = $prevEnd->copy()->subDays($days - 1);

        $prevRevenue = (float) Transaction::query()
            ->whereDate('created_at', '>=', $prevStart->toDateString())
            ->whereDate('created_at', '<=', $prevEnd->toDateString())
            ->whereIn('status', [TransactionStatus::SUCCESS->value, 'sukses', 'success'])
            ->sum('total_payment');

        $pct = $prevRevenue > 0 ? (($revenue - $prevRevenue) / $prevRevenue) * 100 : null;

        return [
            'currentRevenue' => $revenue,
            'previousRevenue' => $prevRevenue,
            'percentChange' => $pct !== null ? round($pct, 2) : null,
        ];
    }
}
