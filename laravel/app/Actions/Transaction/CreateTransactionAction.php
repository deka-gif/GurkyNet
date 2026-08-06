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
     * Status and pricing are always server-controlled (never client-supplied).
     */
    public function execute(User $user, string $skuCode, string $targetNumber, string $pin): Transaction
    {
        $transaction = DB::transaction(function () use ($user, $skuCode, $targetNumber, $pin) {
            
            // 1. Create Draft
            $invoiceNumber = $this->generateUniqueInvoice();
            
            $transaction = $this->transactionRepository->create([
                'user_id' => $user->id,
                'invoice_number' => $invoiceNumber,
                'service_name' => 'Draft Transaction',
                'target_number' => $targetNumber,
                'amount' => 0.00,
                'admin_fee' => 0.00,
                'total_payment' => 0.00,
                'payment_method' => 'wallet',
                'status' => TransactionStatus::DRAFT->value,
                'notes' => 'Transaksi draf baru',
            ]);

            // 2. Validate Product (findBySku already applies Control Center visibility)
            $product = $this->productRepository->findBySku($skuCode);
            if (!$product) {
                throw ValidationException::withMessages([
                    'product_code' => ['Produk tidak ditemukan.'],
                ]);
            }

            // Sellability follows Control Center (active provider SKU), not Digi products.status alone.
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

            // 3. Calculate Price (server-side only)
            $pricingDetails = $this->pricingService->calculateForProduct($product);
            $sellPrice = (float) $pricingDetails['sell_price'];
            $adminFee = (float) $pricingDetails['admin_fee'];
            $totalPayment = $sellPrice + $adminFee;

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

            // 7. Update Transaction from Draft to Final State (always pending for Digiflazz)
            $categoryName = $product->category->name ?? 'Produk PPOB';
            $providerName = $product->provider->name ?? '';
            $serviceName = trim($categoryName . ' ' . $providerName);

            $transaction->update([
                'service_name' => $serviceName,
                'amount' => $sellPrice,
                'admin_fee' => $adminFee,
                'total_payment' => $totalPayment,
                'status' => TransactionStatus::PENDING->value,
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
                    'admin_fee' => $adminFee,
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

        // Dispatch Transaction Created & processing events
        event(new \App\Events\TransactionCreated($transaction));
        event(new \App\Events\TransactionProcessing($transaction));

        // Multi Product Provider router (Digiflazz + VipPulsa + failover).
        // Digiflazz behavior preserved when it is the selected / only enabled provider.
        \App\Jobs\ProcessProductProviderTransaction::dispatch($transaction->id);

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
