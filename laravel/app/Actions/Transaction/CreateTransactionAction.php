<?php

namespace App\Actions\Transaction;

use App\Models\User;
use App\Models\Product;
use App\Models\Transaction;
use App\Models\TransactionItem;
use App\Models\Wallet;
use App\Repositories\Contracts\TransactionRepositoryInterface;
use App\Repositories\Contracts\TransactionItemRepositoryInterface;
use App\Repositories\Contracts\WalletHistoryRepositoryInterface;
use App\Repositories\Contracts\ProductRepositoryInterface;
use App\Services\PricingService;
use App\Services\AvailabilityService;
use App\Enums\TransactionStatus;
use App\Enums\WalletHistoryType;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class CreateTransactionAction
{
    protected TransactionRepositoryInterface $transactionRepository;
    protected TransactionItemRepositoryInterface $itemRepository;
    protected WalletHistoryRepositoryInterface $historyRepository;
    protected ProductRepositoryInterface $productRepository;
    protected PricingService $pricingService;
    protected AvailabilityService $availabilityService;

    public function __construct(
        TransactionRepositoryInterface $transactionRepository,
        TransactionItemRepositoryInterface $itemRepository,
        WalletHistoryRepositoryInterface $historyRepository,
        ProductRepositoryInterface $productRepository,
        PricingService $pricingService,
        AvailabilityService $availabilityService
    ) {
        $this->transactionRepository = $transactionRepository;
        $this->itemRepository = $itemRepository;
        $this->historyRepository = $historyRepository;
        $this->productRepository = $productRepository;
        $this->pricingService = $pricingService;
        $this->availabilityService = $availabilityService;
    }

    /**
     * Execute the create transaction flow atomically.
     */
    public function execute(User $user, string $skuCode, string $targetNumber, string $pin, float $adminFeeOverride = 0.00, string $status = 'success'): Transaction
    {
        $transaction = DB::transaction(function () use ($user, $skuCode, $targetNumber, $pin, $adminFeeOverride, $status) {
            
            // 1. Create Draft
            $invoiceNumber = $this->generateUniqueInvoice();
            
            $transaction = $this->transactionRepository->create([
                'user_id' => $user->id,
                'invoice_number' => $invoiceNumber,
                'service_name' => 'Draft Transaction',
                'target_number' => $targetNumber,
                'amount' => 0.00,
                'admin_fee' => $adminFeeOverride,
                'total_payment' => 0.00,
                'payment_method' => 'wallet',
                'status' => TransactionStatus::DRAFT->value,
                'notes' => 'Transaksi draf baru',
            ]);

            // 2. Validate Product
            $product = $this->productRepository->findBySku($skuCode);
            if (!$product) {
                throw ValidationException::withMessages([
                    'product_code' => ['Produk tidak ditemukan.'],
                ]);
            }

            if (!$product->status) {
                throw ValidationException::withMessages([
                    'product_code' => ['Produk sedang tidak aktif.'],
                ]);
            }

            if (!$this->availabilityService->isAvailable($product)) {
                $statusAvailability = $this->availabilityService->getStatus($product);
                if ($statusAvailability === 'maintenance') {
                    throw ValidationException::withMessages([
                        'product_code' => ['Produk sedang dalam pemeliharaan.'],
                    ]);
                }
                throw ValidationException::withMessages([
                    'product_code' => ['Produk sedang tidak tersedia.'],
                ]);
            }

            // 3. Calculate Price
            $pricingDetails = $this->pricingService->calculateForProduct($product);
            $sellPrice = $pricingDetails['sell_price'];
            $totalPayment = $sellPrice + $adminFeeOverride;

            // 4. Validate Wallet (Lock Wallet)
            $wallet = Wallet::where('user_id', $user->id)->lockForUpdate()->first();
            if (!$wallet) {
                throw new \Exception('Wallet tidak ditemukan.');
            }

            if ($wallet->balance < $totalPayment) {
                throw ValidationException::withMessages([
                    'balance' => ['Saldo tidak mencukupi untuk melakukan transaksi.'],
                ]);
            }

            // 5. Validate PIN
            if ($user->transaction_pin === null) {
                throw ValidationException::withMessages([
                    'pin' => ['PIN transaksi belum diatur. Silakan atur PIN transaksi Anda terlebih dahulu.'],
                ]);
            }

            if (!Hash::check($pin, $user->transaction_pin)) {
                throw ValidationException::withMessages([
                    'pin' => ['PIN transaksi salah.'],
                ]);
            }

            // 6. Deduct Balance
            $wallet->balance -= $totalPayment;
            $wallet->save();

            // 7. Update Transaction from Draft to Final State
            $categoryName = $product->category->name ?? 'Produk PPOB';
            $providerName = $product->provider->name ?? '';
            $serviceName = trim($categoryName . ' ' . $providerName);

            $transaction->update([
                'service_name' => $serviceName,
                'amount' => $sellPrice,
                'total_payment' => $totalPayment,
                'status' => $status,
                'notes' => 'Pembelian ' . $product->name . ' untuk nomor ' . $targetNumber,
            ]);

            // 8. Create Transaction Item
            $this->itemRepository->create([
                'transaction_id' => $transaction->id,
                'product_code' => $product->sku_code,
                'product_name' => $product->name,
                'price' => $sellPrice,
                'quantity' => 1,
                'custom_metadata' => [
                    'base_price' => $pricingDetails['base_price'],
                    'margin' => $pricingDetails['margin'],
                    'admin_fee' => $pricingDetails['admin_fee'],
                    'provider' => $providerName,
                    'sku' => $product->sku_code,
                ],
            ]);

            // 9. Create Wallet History
            $this->historyRepository->create([
                'wallet_id' => $wallet->id,
                'amount' => $totalPayment,
                'type' => WalletHistoryType::DEBIT->value,
                'description' => 'Pembelian ' . $product->name . ' - ' . $targetNumber,
                'reference_id' => $transaction->id,
            ]);

            // Dispatch WalletDebited
            event(new \App\Events\WalletDebited($wallet, $totalPayment, 'Pembelian ' . $product->name . ' - ' . $targetNumber, $transaction->id));

            // Load items relationship
            $transaction->load('items');

            return $transaction;
        });

        // Dispatch Transaction Created & state events
        event(new \App\Events\TransactionCreated($transaction));

        if (in_array($transaction->status, ['pending', 'processing'])) {
            event(new \App\Events\TransactionProcessing($transaction));
        } elseif (in_array($transaction->status, ['success', 'sukses'])) {
            event(new \App\Events\TransactionSuccess($transaction));
        } elseif (in_array($transaction->status, ['failed', 'cancel', 'canceled'])) {
            event(new \App\Events\TransactionFailed($transaction));
        }

        if ($transaction->status === \App\Enums\TransactionStatus::PENDING->value || $transaction->status === 'pending') {
            \App\Jobs\ProcessDigiflazzTransaction::dispatch($transaction->id);
        }

        return $transaction;
    }

    /**
     * Generate unique Invoice number with format: GRK-YYYYMMDD-XXXXXX
     */
    protected function generateUniqueInvoice(): string
    {
        $date = now()->format('Ymd');
        
        // Find the last invoice created today
        $lastTransaction = Transaction::where('invoice_number', 'like', "GRK-{$date}-%")
            ->orderBy('id', 'desc')
            ->first();

        $nextNumber = 1;
        if ($lastTransaction) {
            $parts = explode('-', $lastTransaction->invoice_number);
            $lastNum = (int) end($parts);
            $nextNumber = $lastNum + 1;
        }

        return 'GRK-' . $date . '-' . str_pad($nextNumber, 6, '0', STR_PAD_LEFT);
    }
}
