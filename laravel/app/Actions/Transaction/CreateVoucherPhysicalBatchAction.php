<?php

namespace App\Actions\Transaction;

use App\Enums\TransactionStatus;
use App\Models\User;
use App\Models\VoucherPhysicalBatch;
use App\Models\VoucherPhysicalBatchItem;
use App\Models\Wallet;
use App\Models\WalletMutation;
use App\Repositories\Contracts\ProductRepositoryInterface;
use App\Repositories\Contracts\TransactionRepositoryInterface;
use App\Services\AvailabilityService;
use App\Services\PricingService;
use App\Services\Transactions\IdempotencyGuard;
use App\Services\Wallet\WalletLedgerService;
use App\Support\Transactions\InvoiceNumberGenerator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/**
 * Voucher Fisik bulk activation — one PIN entry, one wallet hold for the whole batch
 * (this Transaction row is what Riwayat lists), but N independently-tracked serials in
 * voucher_physical_batches / voucher_physical_batch_items. Deliberately NOT built on top
 * of CreateTransactionAction: that Action's 1-SKU/1-target/1-item assumption doesn't fit
 * a batch, though the surrounding gates (KYC, feature flag, PIN, wallet lock, idempotency)
 * mirror it closely on purpose.
 */
class CreateVoucherPhysicalBatchAction
{
    public function __construct(
        protected TransactionRepositoryInterface $transactionRepository,
        protected ProductRepositoryInterface $productRepository,
        protected PricingService $pricingService,
        protected AvailabilityService $availabilityService,
        protected IdempotencyGuard $idempotencyGuard,
        protected WalletLedgerService $ledgerService,
    ) {}

    /**
     * @param  array<int, array{serial_number: string, scanned_at?: string|null}>  $serials
     */
    public function execute(
        User $user,
        string $skuCode,
        array $serials,
        string $pin,
        ?string $idempotencyKey = null
    ): VoucherPhysicalBatch {
        app(\App\Services\Kyc\IdentityVerificationGate::class)->assertTier1($user);

        $gate = app(\App\Support\Features\TransactionFeatureGate::class);
        if (! $gate->purchaseEnabled()) {
            throw ValidationException::withMessages([
                'sku_code' => [$gate->purchaseDisabledMessage()],
            ]);
        }

        $cleanSerials = $this->dedupeAndClean($serials);
        if ($cleanSerials === []) {
            throw ValidationException::withMessages([
                'serials' => ['Masukkan minimal 1 nomor seri voucher yang valid.'],
            ]);
        }

        $maxItems = (int) config('ppob.physical_batch.max_items', 200);
        if (count($cleanSerials) > $maxItems) {
            throw ValidationException::withMessages([
                'serials' => ["Maksimal {$maxItems} SN per batch."],
            ]);
        }

        $isReplay = false;

        $batch = DB::transaction(function () use ($user, $skuCode, $cleanSerials, $pin, $idempotencyKey, &$isReplay) {
            $invoiceNumber = InvoiceNumberGenerator::generate();

            $claim = $this->idempotencyGuard->claim(
                $user->id,
                $idempotencyKey,
                function () use ($user, $invoiceNumber, $idempotencyKey) {
                    return $this->transactionRepository->create([
                        'user_id' => $user->id,
                        'invoice_number' => $invoiceNumber,
                        'service_name' => 'Draft Voucher Fisik Batch',
                        'target_number' => 'BATCH',
                        'amount' => 0.00,
                        'admin_fee' => 0.00,
                        'total_payment' => 0.00,
                        'payment_method' => 'wallet',
                        'status' => TransactionStatus::INITIATED->value,
                        'notes' => 'Batch voucher fisik (INITIATED)',
                        'idempotency_key' => $idempotencyKey,
                    ]);
                }
            );

            if (! $claim['is_new']) {
                $isReplay = true;

                return VoucherPhysicalBatch::where('transaction_id', $claim['transaction']->id)
                    ->with('items')
                    ->firstOrFail();
            }

            $transaction = $claim['transaction'];

            $product = $this->productRepository->findBySku($skuCode);
            if (! $product) {
                throw ValidationException::withMessages([
                    'sku_code' => ['Produk tidak ditemukan.'],
                ]);
            }

            // Hard server-side category gate — Voucher Fisik is exclusively Kuota/Internet.
            // Scoped to THIS new endpoint only; the shared /transactions endpoint used by
            // every other PPOB category is untouched.
            if (($product->category?->slug ?? '') !== 'voucher-internet') {
                throw ValidationException::withMessages([
                    'sku_code' => ['Produk ini bukan kategori Voucher Internet.'],
                ]);
            }

            if (! $this->availabilityService->isAvailable($product)) {
                $statusAvailability = $this->availabilityService->getStatus($product);
                throw ValidationException::withMessages([
                    'sku_code' => [$statusAvailability === 'maintenance'
                        ? 'Produk atau provider sedang maintenance. Pembelian tidak dapat diproses.'
                        : 'Produk tidak aktif atau provider offline. Transaksi dibatalkan.'],
                ]);
            }

            $pricing = $this->pricingService->calculateForProduct($product);
            $unitPrice = (float) $pricing['sell_price'] + (float) $pricing['admin_fee'];
            $count = count($cleanSerials);
            $totalPayment = $unitPrice * $count;

            $wallet = Wallet::where('user_id', $user->id)->lockForUpdate()->first();
            if (! $wallet) {
                throw new \Exception('Wallet tidak ditemukan.');
            }

            if ($wallet->balance < $totalPayment) {
                throw ValidationException::withMessages([
                    'balance' => ['Saldo tidak mencukupi untuk melakukan transaksi.'],
                ]);
            }

            if ($user->transaction_pin === null) {
                throw ValidationException::withMessages([
                    'pin' => ['PIN transaksi belum diatur. Silakan atur PIN transaksi Anda terlebih dahulu.'],
                ]);
            }
            if (! Hash::check($pin, $user->transaction_pin)) {
                throw ValidationException::withMessages([
                    'pin' => ['PIN transaksi salah.'],
                ]);
            }

            $wallet->balance -= $totalPayment;
            $wallet->save();

            $operatorName = $product->provider->name ?? null;
            $historyDesc = 'Aktivasi Voucher Fisik ' . $product->name . ' (' . $count . ' SN)';

            $this->ledgerService->record(
                $wallet,
                WalletMutation::TYPE_HOLD,
                $totalPayment,
                'debit',
                $historyDesc,
                $transaction->id
            );

            $transaction->update([
                'service_name' => 'Voucher Fisik ' . $product->name,
                'amount' => $unitPrice * $count,
                'admin_fee' => 0.00,
                'total_payment' => $totalPayment,
                'status' => TransactionStatus::LOCKED->value,
                'notes' => $historyDesc,
            ]);

            $batch = VoucherPhysicalBatch::create([
                'transaction_id' => $transaction->id,
                'user_id' => $user->id,
                'product_id' => $product->id,
                'sku_code' => $product->sku_code,
                'operator_name' => $operatorName,
                'quota_label' => $product->name,
                'unit_price' => $unitPrice,
                'total_serials' => $count,
                'status' => VoucherPhysicalBatch::STATUS_PENDING,
            ]);

            foreach ($cleanSerials as $entry) {
                VoucherPhysicalBatchItem::create([
                    'batch_id' => $batch->id,
                    'serial_number' => $entry['serial_number'],
                    'status' => VoucherPhysicalBatchItem::STATUS_QUEUED,
                    'scanned_at' => $entry['scanned_at'] ?? now(),
                ]);
            }

            event(new \App\Events\WalletDebited($wallet, $totalPayment, $historyDesc, $transaction->id));

            return $batch->load('items');
        });

        if ($isReplay) {
            return $batch;
        }

        \App\Jobs\ProcessVoucherPhysicalBatch::dispatch($batch->id);

        return $batch;
    }

    /**
     * Trim, drop empties, and de-duplicate serials server-side — defense in depth behind
     * the frontend's own local dedup during scanning.
     *
     * @param  array<int, array{serial_number: string, scanned_at?: string|null}>  $serials
     * @return array<int, array{serial_number: string, scanned_at: ?string}>
     */
    protected function dedupeAndClean(array $serials): array
    {
        $seen = [];
        $out = [];

        foreach ($serials as $entry) {
            $sn = trim((string) ($entry['serial_number'] ?? ''));
            if ($sn === '' || isset($seen[$sn])) {
                continue;
            }
            $seen[$sn] = true;
            $out[] = [
                'serial_number' => $sn,
                'scanned_at' => $entry['scanned_at'] ?? null,
            ];
        }

        return $out;
    }
}
