<?php

namespace App\Console\Commands;

use App\Models\DigiflazzTransaction;
use App\Models\PaymentHistory;
use App\Models\Product;
use App\Models\ProductProviderSku;
use App\Models\ProductProviderLog;
use App\Models\Transaction;
use App\Models\WalletHistory;
use App\Models\WalletMutation;
use App\Services\ProductProviders\LogicalProductKey;
use App\Services\ProductProviders\ProductRoutingService;
use Illuminate\Console\Command;

/**
 * Read-only diagnostic: reconstruct provider routing, wallet ledger, and refund
 * trail for one or more transaction invoices. Never calls external providers.
 */
class DiagnoseTransactionCommand extends Command
{
    protected $signature = 'gurkynet:diagnose-transaction
                            {invoices* : One or more invoice numbers, e.g. GRK-20260901-000004}';

    protected $description = 'Read-only: diagnose transaction provider logs, wallet mutations, and product mapping for given invoice(s).';

    public function handle(ProductRoutingService $routing): int
    {
        $invoices = array_values(array_filter(array_map('trim', $this->argument('invoices'))));

        if ($invoices === []) {
            $this->error('Provide at least one invoice number.');

            return self::FAILURE;
        }

        foreach ($invoices as $index => $invoice) {
            if ($index > 0) {
                $this->newLine(2);
                $this->line(str_repeat('=', 72));
                $this->newLine();
            }

            $this->diagnoseInvoice($invoice, $routing);
        }

        return self::SUCCESS;
    }

    protected function diagnoseInvoice(string $invoice, ProductRoutingService $routing): void
    {
        $this->info("=== DIAGNOSE TRANSACTION: {$invoice} ===");

        $tx = Transaction::withTrashed()
            ->with(['items', 'user.wallet'])
            ->where('invoice_number', $invoice)
            ->first();

        if (!$tx) {
            $this->warn("Invoice not found: {$invoice}");

            return;
        }

        $this->section('TRANSACTION');
        $this->table(
            ['Field', 'Value'],
            $this->keyValueRows([
                'id' => $tx->id,
                'invoice_number' => $tx->invoice_number,
                'status' => $tx->status,
                'user_id' => $tx->user_id,
                'product_id (from item)' => $tx->items->first()?->product_id,
                'service_name' => $tx->service_name,
                'target_number' => $tx->target_number,
                'amount' => $tx->amount,
                'admin_fee' => $tx->admin_fee,
                'total_payment' => $tx->total_payment,
                'payment_method' => $tx->payment_method,
                'fulfillment_provider_code' => $tx->fulfillment_provider_code,
                'provider_sku_used' => $tx->provider_sku_used,
                'provider_ref' => $tx->provider_ref,
                'provider_last_status' => $tx->provider_last_status,
                'provider_checked_at' => $this->fmtTime($tx->provider_checked_at),
                'provider_dispatch_started_at' => $this->fmtTime($tx->provider_dispatch_started_at),
                'timeout_at' => $this->fmtTime($tx->timeout_at),
                'notes' => $tx->notes,
                'refunded_at' => $this->fmtTime($tx->refunded_at),
                'refund_reference' => $tx->refund_reference,
                'completed_at' => $this->fmtTime($tx->completed_at),
                'channel' => $tx->channel,
                'created_at' => $this->fmtTime($tx->created_at),
                'updated_at' => $this->fmtTime($tx->updated_at),
                'deleted_at' => $this->fmtTime($tx->deleted_at),
            ])
        );

        if (is_array($tx->provider_response) && $tx->provider_response !== []) {
            $this->line('provider_response (JSON):');
            $this->line($this->prettyJson($tx->provider_response));
        }

        $this->section('PRODUCT_PROVIDER_LOGS (chronological)');
        $logs = ProductProviderLog::query()
            ->where('transaction_id', $tx->id)
            ->orderBy('created_at')
            ->orderBy('id')
            ->get();

        if ($logs->isEmpty()) {
            $this->warn('No product_provider_logs rows for this transaction.');
        } else {
            foreach ($logs as $i => $log) {
                $this->line(sprintf(
                    '#%d [%s] event=%s selected=%s fallback=%s success=%s reason=%s rt=%sms',
                    $i + 1,
                    $this->fmtTime($log->created_at),
                    $log->event_type,
                    $log->selected_provider_code ?? '-',
                    $log->fallback_provider_code ?? '-',
                    $log->success ? 'yes' : 'no',
                    $log->reason ?? '-',
                    $log->response_time_ms ?? '-'
                ));
                if ($log->error_message) {
                    $this->line('  error_message: '.$log->error_message);
                }
                if (is_array($log->meta) && $log->meta !== []) {
                    $this->line('  meta: '.$this->prettyJson($log->meta));
                }
            }
        }

        $this->section('DIGIFLAZZ_TRANSACTIONS');
        $digiRows = DigiflazzTransaction::where('transaction_id', $tx->id)->get();
        if ($digiRows->isEmpty()) {
            $this->line('(none)');
        } else {
            foreach ($digiRows as $d) {
                $this->table(
                    ['Field', 'Value'],
                    $this->keyValueRows([
                        'id' => $d->id,
                        'ref_id' => $d->ref_id,
                        'buyer_sku_code' => $d->buyer_sku_code,
                        'digiflazz_status' => $d->digiflazz_status,
                        'rc' => $d->rc,
                        'customer_no' => $d->customer_no,
                        'sn' => $d->sn,
                        'price' => $d->price,
                        'message' => $d->message,
                        'created_at' => $this->fmtTime($d->created_at),
                    ])
                );
                if (is_array($d->raw_response) && $d->raw_response !== []) {
                    $this->line('raw_response:');
                    $this->line($this->prettyJson($d->raw_response));
                }
            }
        }

        $this->section('PAYMENT_HISTORY');
        $payments = PaymentHistory::where('transaction_id', $tx->id)->orderBy('updated_at')->get();
        if ($payments->isEmpty()) {
            $this->line('(none)');
        } else {
            foreach ($payments as $p) {
                $this->table(
                    ['Field', 'Value'],
                    $this->keyValueRows([
                        'id' => $p->id,
                        'gateway' => $p->gateway,
                        'status' => $p->status,
                        'payment_code' => $p->payment_code,
                        'created_at' => $this->fmtTime($p->created_at),
                        'updated_at' => $this->fmtTime($p->updated_at),
                    ])
                );
                if (is_array($p->payload) && $p->payload !== []) {
                    $this->line('payload: '.$this->prettyJson($p->payload));
                }
            }
        }

        $this->section('WALLET LEDGER (debit / refund sequence)');
        $refId = (string) $tx->id;
        $mutations = WalletMutation::where('reference_id', $refId)->orderBy('created_at')->orderBy('id')->get();
        $histories = WalletHistory::where('reference_id', $refId)->orderBy('created_at')->orderBy('id')->get();

        if ($mutations->isEmpty() && $histories->isEmpty()) {
            $this->warn('No wallet_mutations or wallet_histories linked via reference_id='.$refId);
        } else {
            if ($mutations->isNotEmpty()) {
                $this->line('wallet_mutations:');
                $this->table(
                    ['id', 'type', 'amount', 'reference_id', 'created_at'],
                    $mutations->map(fn ($m) => [
                        $m->id,
                        $m->type,
                        $m->amount,
                        $m->reference_id,
                        $this->fmtTime($m->created_at),
                    ])->all()
                );
            }
            if ($histories->isNotEmpty()) {
                $this->line('wallet_histories:');
                $this->table(
                    ['id', 'type', 'amount', 'description', 'reference_id', 'created_at'],
                    $histories->map(fn ($h) => [
                        $h->id,
                        $h->type,
                        $h->amount,
                        $h->description,
                        $h->reference_id,
                        $this->fmtTime($h->created_at),
                    ])->all()
                );
            }

            $wallet = $tx->user?->wallet;
            if ($wallet) {
                $this->line(sprintf(
                    'Current wallet balance (authoritative DB): Rp%s (wallet_id=%s)',
                    number_format((float) $wallet->balance, 0, ',', '.'),
                    $wallet->id
                ));
            }
        }

        $productId = $tx->items->first()?->product_id;
        $this->section('PRODUCT PROVIDER SKU MAPPING (purchased product + logical siblings)');

        if (!$productId) {
            $this->warn('No product_id on transaction items — cannot resolve SKU mapping.');
            return;
        }

        $product = Product::with(['category', 'provider', 'providerSkus.productProvider'])
            ->find($productId);

        if (!$product) {
            $this->warn("Product #{$productId} not found.");

            return;
        }

        $groupKey = LogicalProductKey::groupKey($product);
        $siblingIds = $routing->logicalSiblingProductIdsPublic($product);

        $this->line('Purchased product: #'.$product->id.' | '.$product->name.' | sku='.$product->sku_code);
        $this->line('Category: '.($product->category?->slug ?? '-').' | Brand/provider_id: '.($product->provider_id ?? '-').' ('.($product->provider?->name ?? '-').')');
        $this->line('LogicalProductKey::groupKey(): '.$groupKey);
        $this->line('Logical sibling product_ids: '.implode(', ', $siblingIds));
        $this->line('extractDenomination(name): '.(LogicalProductKey::extractDenomination((string) $product->name) ?? 'null'));

        $skus = ProductProviderSku::query()
            ->with('productProvider')
            ->whereIn('product_id', $siblingIds)
            ->orderBy('product_id')
            ->orderBy('product_provider_id')
            ->get();

        if ($skus->isEmpty()) {
            $this->warn('No product_provider_skus rows for this logical group.');
        } else {
            $this->table(
                ['product_id', 'product_name', 'provider', 'provider_sku', 'is_active', 'is_preferred', 'provider_status'],
                $skus->map(function (ProductProviderSku $sku) {
                    $prod = Product::find($sku->product_id);

                    return [
                        $sku->product_id,
                        $prod?->name ?? '-',
                        $sku->productProvider?->code ?? '-',
                        $sku->provider_sku,
                        $sku->is_active ? 'yes' : 'no',
                        $sku->is_preferred ? 'YES' : 'no',
                        $sku->provider_status ?? '-',
                    ];
                })->all()
            );
        }

        $ordered = $routing->orderedOffersForProduct($product, (int) $tx->id);
        $this->line('ProductRoutingService::orderedOffersForProduct() at diagnosis time:');
        if ($ordered->isEmpty()) {
            $this->warn('  (no eligible offers — same checks as checkout routing)');
        } else {
            foreach ($ordered->values() as $i => $offer) {
                $pp = $offer->productProvider;
                $this->line(sprintf(
                    '  %d) %s priority=%s sku=%s product_id=%s is_preferred=%s',
                    $i + 1,
                    $pp?->code ?? '?',
                    $pp?->priority ?? '?',
                    $offer->provider_sku,
                    $offer->product_id,
                    $offer->is_preferred ? 'YES' : 'no'
                ));
            }
        }
    }

    protected function section(string $title): void
    {
        $this->newLine();
        $this->info('--- '.$title.' ---');
    }

    /**
     * @param  array<string, mixed>  $data
     * @return list<array{0: string, 1: string}>
     */
    protected function keyValueRows(array $data): array
    {
        $rows = [];
        foreach ($data as $key => $value) {
            if ($value === null || $value === '') {
                continue;
            }
            $rows[] = [$key, is_scalar($value) ? (string) $value : $this->prettyJson($value)];
        }

        return $rows;
    }

    protected function fmtTime(mixed $dt): string
    {
        if ($dt === null) {
            return '-';
        }

        try {
            return (string) $dt;
        } catch (\Throwable) {
            return '-';
        }
    }

    /**
     * @param  array<string, mixed>|mixed  $data
     */
    protected function prettyJson(mixed $data): string
    {
        return json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{}';
    }
}
