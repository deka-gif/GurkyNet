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
use App\Services\Tagihan\TagihanInquiryService;
use App\Services\Pln\PlnInquiryService;
use App\Services\Game\GameInquiryService;
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
    protected TagihanInquiryService $tagihanInquiryService;
    protected PlnInquiryService $plnInquiryService;
    protected GameInquiryService $gameInquiryService;

    public function __construct(
        TransactionRepositoryInterface $transactionRepository,
        TransactionItemRepositoryInterface $itemRepository,
        WalletHistoryRepositoryInterface $historyRepository,
        ProductRepositoryInterface $productRepository,
        PricingService $pricingService,
        AvailabilityService $availabilityService,
        TagihanInquiryService $tagihanInquiryService,
        PlnInquiryService $plnInquiryService,
        GameInquiryService $gameInquiryService
    ) {
        $this->transactionRepository = $transactionRepository;
        $this->itemRepository = $itemRepository;
        $this->historyRepository = $historyRepository;
        $this->productRepository = $productRepository;
        $this->pricingService = $pricingService;
        $this->availabilityService = $availabilityService;
        $this->gameInquiryService = $gameInquiryService;
        $this->tagihanInquiryService = $tagihanInquiryService;
        $this->plnInquiryService = $plnInquiryService;
    }

    /**
     * Execute the create transaction flow atomically.
     * Status and pricing are always server-controlled (never client-supplied).
     * Postpaid tagihan: pass inquiry_ref_id from Digiflazz inq-pasca session.
     */
    public function execute(
        User $user,
        string $skuCode,
        string $targetNumber,
        string $pin,
        ?string $inquiryRefId = null
    ): Transaction {
        $transaction = DB::transaction(function () use ($user, $skuCode, $targetNumber, $pin, $inquiryRefId) {
            
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

            // Re-validate Ops Product + Provider status at checkout (never trust client).
            // Sellability follows Control Center SKUs + ops_status + partner_status.
            if (!$this->availabilityService->isAvailable($product)) {
                $statusAvailability = $this->availabilityService->getStatus($product);
                if ($statusAvailability === 'maintenance') {
                    throw ValidationException::withMessages([
                        'product_code' => ['Produk atau provider sedang maintenance. Pembelian tidak dapat diproses.'],
                    ]);
                }
                throw ValidationException::withMessages([
                    'product_code' => ['Produk tidak aktif atau provider offline. Transaksi dibatalkan.'],
                ]);
            }

            $inquirySession = null;
            $isPasca = is_string($inquiryRefId) && trim($inquiryRefId) !== '';

            if ($isPasca) {
                $inquirySession = $this->tagihanInquiryService->getSession($user->id, trim($inquiryRefId));
                if (!$inquirySession) {
                    throw ValidationException::withMessages([
                        'inquiry_ref_id' => ['Sesi inquiry kedaluwarsa. Silakan cek tagihan ulang.'],
                    ]);
                }
                if (($inquirySession['sku_code'] ?? null) !== $product->sku_code) {
                    throw ValidationException::withMessages([
                        'inquiry_ref_id' => ['SKU tidak sesuai dengan hasil inquiry.'],
                    ]);
                }
                if ((string) ($inquirySession['customer_no'] ?? '') !== (string) $targetNumber) {
                    throw ValidationException::withMessages([
                        'inquiry_ref_id' => ['Nomor pelanggan tidak sesuai dengan hasil inquiry.'],
                    ]);
                }

                // Charge Digiflazz selling_price (provider-authoritative). Never trust client amounts.
                $sellPrice = (float) $inquirySession['bill_amount'];
                $adminFee = (float) $inquirySession['admin_fee'];
                $totalPayment = (float) $inquirySession['selling_price'];
                if ($totalPayment <= 0) {
                    throw ValidationException::withMessages([
                        'inquiry_ref_id' => ['Nominal pembayaran dari inquiry tidak valid.'],
                    ]);
                }
                // Keep amount + admin aligned with total when provider rounding differs.
                if (abs(($sellPrice + $adminFee) - $totalPayment) > 0.009) {
                    $sellPrice = max(0.0, $totalPayment - $adminFee);
                }
                $pricingDetails = [
                    'base_price' => (float) ($inquirySession['provider_price'] ?? $sellPrice),
                    'margin' => 0,
                    'sell_price' => $sellPrice,
                    'admin_fee' => $adminFee,
                ];
            } else {
                // 3. Calculate Price (server-side only) — prepaid catalog
                $pricingDetails = $this->pricingService->calculateForProduct($product);
                $sellPrice = (float) $pricingDetails['sell_price'];
                $adminFee = (float) $pricingDetails['admin_fee'];
                $totalPayment = $sellPrice + $adminFee;
            }

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

            $providerRef = $isPasca ? (string) $inquirySession['inquiry_ref_id'] : null;

            $transaction->update([
                'service_name' => $serviceName,
                'amount' => $sellPrice,
                'admin_fee' => $adminFee,
                'total_payment' => $totalPayment,
                'status' => TransactionStatus::PENDING->value,
                'provider_ref' => $providerRef,
                'notes' => $isPasca
                    ? (!empty($inquirySession['is_ewallet'])
                        ? ('Top Up Digital ' . $product->name . ' untuk ' . $targetNumber)
                        : ('Pembayaran tagihan ' . $product->name . ' untuk ' . $targetNumber))
                    : ('Pembelian ' . $product->name . ' untuk nomor ' . $targetNumber),
            ]);

            // 8. Create Transaction Item
            $itemMeta = [
                'base_price' => $pricingDetails['base_price'],
                'margin' => $pricingDetails['margin'],
                'admin_fee' => $adminFee,
                'provider' => $providerName,
                'sku' => $product->sku_code,
            ];
            if ($isPasca && $inquirySession) {
                $itemMeta['is_pasca'] = true;
                $itemMeta['inquiry_ref_id'] = $inquirySession['inquiry_ref_id'];
                $itemMeta['provider_sku'] = $inquirySession['provider_sku'] ?? null;
                $itemMeta['customer_name'] = $inquirySession['customer_name'] ?? null;
                $itemMeta['periode'] = $inquirySession['periode'] ?? null;
                $itemMeta['selling_price'] = $inquirySession['selling_price'] ?? $totalPayment;
                $itemMeta['denda'] = $inquirySession['denda'] ?? 0;
                $itemMeta['bill_amount'] = $inquirySession['bill_amount'] ?? $sellPrice;
                if (!empty($inquirySession['is_ewallet'])) {
                    $itemMeta['is_ewallet'] = true;
                    $itemMeta['nominal_amount'] = $inquirySession['nominal_amount']
                        ?? $inquirySession['bill_amount']
                        ?? $sellPrice;
                }
                if (!empty($inquirySession['tax_details']) && is_array($inquirySession['tax_details'])) {
                    $itemMeta['tax_details'] = $inquirySession['tax_details'];
                }
                $catSlug = strtolower((string) ($inquirySession['category_slug'] ?? $product->category?->slug ?? ''));
                if (in_array($catSlug, ['pbb', 'samsat'], true)) {
                    $itemMeta['is_pajak_negara'] = true;
                    $itemMeta['pajak_jenis'] = $catSlug;
                }
            }

            $plnSession = null;
            if (!$isPasca && $this->isPlnTokenProduct($product)) {
                $plnSession = $this->plnInquiryService->getSession($user->id, $targetNumber);
                if (!$plnSession) {
                    throw ValidationException::withMessages([
                        'target_number' => ['Silakan cek meteran PLN terlebih dahulu sebelum membeli token.'],
                    ]);
                }
                $itemMeta['pln_prepaid'] = true;
                $itemMeta['customer_name'] = $plnSession['customer_name'] ?? null;
                $itemMeta['segment_power'] = $plnSession['segment_power'] ?? null;
                $itemMeta['meter_no'] = $plnSession['meter_no'] ?? null;
                $itemMeta['subscriber_id'] = $plnSession['subscriber_id'] ?? null;
            }

            $gameSession = null;
            if (!$isPasca && $this->isGameProduct($product)) {
                $gameSession = $this->gameInquiryService->getSession($user->id, $targetNumber);
                if (!$gameSession) {
                    throw ValidationException::withMessages([
                        'target_number' => ['Silakan validasi akun game terlebih dahulu sebelum top up.'],
                    ]);
                }
                if (($gameSession['sku_code'] ?? null) !== $product->sku_code) {
                    throw ValidationException::withMessages([
                        'target_number' => ['SKU tidak sesuai dengan hasil validasi game.'],
                    ]);
                }
                $itemMeta['is_game'] = true;
                $itemMeta['nickname'] = $gameSession['nickname'] ?? null;
                $itemMeta['customer_name'] = $gameSession['nickname'] ?? null;
                $itemMeta['game_brand'] = $gameSession['brand'] ?? ($product->provider->name ?? null);
                $itemMeta['game_label'] = $gameSession['game_label'] ?? null;
                $itemMeta['user_id'] = $gameSession['user_id'] ?? null;
                $itemMeta['zone_id'] = $gameSession['zone_id'] ?? null;
                $itemMeta['game_inquiry_ref_id'] = $gameSession['inquiry_ref_id'] ?? null;
            }

            if (!$isPasca && $this->isVoucherDigitalProduct($product)) {
                $itemMeta['is_voucher'] = true;
                $itemMeta['voucher_brand'] = $product->provider->name ?? null;
            }

            if (!$isPasca && $this->isLanggananDigitalProduct($product)) {
                $itemMeta['is_langganan'] = true;
                $itemMeta['langganan_brand'] = $product->provider->name ?? null;
            }

            $this->itemRepository->create([
                'transaction_id' => $transaction->id,
                'product_code' => $product->sku_code,
                'product_name' => $product->name,
                'price' => $isPasca ? $totalPayment : $sellPrice,
                'quantity' => 1,
                'custom_metadata' => $itemMeta,
            ]);

            // 9. Create Wallet History
            $historyDesc = ($isPasca ? 'Pembayaran tagihan ' : 'Pembelian ') . $product->name . ' - ' . $targetNumber;
            $this->historyRepository->create([
                'wallet_id' => $wallet->id,
                'amount' => $totalPayment,
                'type' => WalletHistoryType::DEBIT->value,
                'description' => $historyDesc,
                'reference_id' => $transaction->id,
            ]);

            // Dispatch WalletDebited
            event(new \App\Events\WalletDebited($wallet, $totalPayment, $historyDesc, $transaction->id));

            if ($isPasca && $inquirySession) {
                $this->tagihanInquiryService->forgetSession($user->id, (string) $inquirySession['inquiry_ref_id']);
            }
            if ($plnSession) {
                $this->plnInquiryService->forgetSession($user->id, $targetNumber);
            }
            if ($gameSession) {
                $this->gameInquiryService->forgetSession($user->id, $targetNumber);
            }

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

        // Arm timeout ladder immediately after create (async — never blocks HTTP).
        app(\App\Services\Transactions\TransactionTimeoutService::class)->arm($transaction->fresh() ?? $transaction);

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

    protected function isPlnTokenProduct(Product $product): bool
    {
        $slug = strtolower((string) ($product->category?->slug ?? ''));
        if (in_array($slug, ['pln', 'token-pln', 'token_pln'], true)) {
            return true;
        }

        $hay = strtolower(trim(($product->name ?? '') . ' ' . ($product->sku_code ?? '')));

        return str_contains($hay, 'token') && str_contains($hay, 'pln');
    }

    protected function isGameProduct(Product $product): bool
    {
        $slug = strtolower((string) ($product->category?->slug ?? ''));

        return in_array($slug, ['game', 'games', 'topup-game', 'top-up-game', 'game-feature'], true);
    }

    protected function isVoucherDigitalProduct(Product $product): bool
    {
        $slug = strtolower((string) ($product->category?->slug ?? ''));

        return in_array($slug, ['voucher-digital', 'voucher', 'gift-card', 'egift', 'e-gift'], true);
    }

    protected function isLanggananDigitalProduct(Product $product): bool
    {
        $slug = strtolower((string) ($product->category?->slug ?? ''));

        return in_array($slug, ['langganan-digital', 'streaming', 'streaming-tv', 'aplikasi', 'apps'], true);
    }
}
