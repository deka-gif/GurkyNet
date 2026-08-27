<?php

namespace App\Services\PartnerApi;

use App\Enums\TransactionStatus;
use App\Jobs\ProcessProductProviderTransaction;
use App\Models\ApiCredential;
use App\Models\ApiPartner;
use App\Models\PartnerWallet;
use App\Models\Product;
use App\Models\Transaction;
use App\Models\TransactionItem;
use App\Services\AvailabilityService;
use App\Services\Transactions\IdempotencyRequestService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * FR-API-05 / 30.5 — partner execute via existing transactions + ProviderRouter path.
 * Does NOT use CreateTransactionAction (user purchase gate / user wallet / PIN).
 */
class PartnerExecuteService
{
    public function __construct(
        protected PartnerPricingService $pricing,
        protected PartnerWalletService $walletService,
        protected AvailabilityService $availability,
        protected IdempotencyRequestService $idempotency,
        protected PartnerAuthService $auth,
    ) {}

    /**
     * @param  array{sku_code:string,target_number:string,partner_ref:string,idempotency_key:string}  $payload
     * @return array{replay:bool,transaction:?Transaction,sandbox:bool,data:array}
     */
    public function execute(ApiPartner $partner, ApiCredential $credential, array $payload): array
    {
        $sandbox = (bool) $credential->is_sandbox;

        if ($sandbox) {
            if (! $this->auth->sandboxEnabled()) {
                throw ValidationException::withMessages(['sandbox' => ['Sandbox partner API dinonaktifkan.']]);
            }
        } elseif (! $this->auth->partnerApiEnabled()) {
            throw ValidationException::withMessages([
                'partner_api' => ['Partner API production belum diaktifkan (PARTNER_API_ENABLED=false).'],
            ]);
        }

        $key = (string) $payload['idempotency_key'];
        $endpoint = 'partner_api:execute:'.$partner->id;
        $idemPayload = [
            'sku_code' => $payload['sku_code'],
            'target_number' => $payload['target_number'],
            'partner_ref' => $payload['partner_ref'],
            'sandbox' => $sandbox,
        ];

        $run = $this->idempotency->run(
            $partner->user_id,
            $key,
            $endpoint,
            $idemPayload,
            function () use ($partner, $credential, $payload, $sandbox) {
                $tx = $this->createTransaction($partner, $credential, $payload, $sandbox);
                $snapshot = [
                    'http_status' => 201,
                    'data' => $this->publicTx($tx, $sandbox),
                ];

                return ['result' => $tx, 'snapshot' => $snapshot, 'http_status' => 201];
            }
        );

        if ($run['replay']) {
            $snap = $run['snapshot'] ?? [];
            $data = $snap['data'] ?? $snap;

            return [
                'replay' => true,
                'transaction' => null,
                'sandbox' => $sandbox,
                'data' => is_array($data) ? $data : [],
            ];
        }

        /** @var Transaction $tx */
        $tx = $run['result'];

        return [
            'replay' => false,
            'transaction' => $tx,
            'sandbox' => $sandbox,
            'data' => $this->publicTx($tx, $sandbox),
        ];
    }

    /**
     * @param  array{sku_code:string,target_number:string,partner_ref:string,idempotency_key:string}  $payload
     */
    protected function createTransaction(ApiPartner $partner, ApiCredential $credential, array $payload, bool $sandbox): Transaction
    {
        if (! $partner->user_id) {
            throw ValidationException::withMessages([
                'partner' => ['Partner belum terhubung ke akun portal.'],
            ]);
        }

        $product = Product::where('sku_code', $payload['sku_code'])->first();
        if (! $product) {
            throw ValidationException::withMessages(['sku_code' => ['Produk tidak ditemukan.']]);
        }
        if (! $this->availability->isAvailable($product)) {
            throw ValidationException::withMessages(['sku_code' => ['Produk tidak aktif atau tidak tersedia.']]);
        }

        $sellPrice = $this->pricing->resolvePartnerSellPrice($partner, $product);
        $adminFee = (float) ($product->admin_fee ?? 0);
        $total = $sellPrice + $adminFee;

        $transaction = DB::transaction(function () use ($partner, $credential, $payload, $product, $sellPrice, $adminFee, $total, $sandbox) {
            $wallet = PartnerWallet::where('partner_id', $partner->id)->lockForUpdate()->first();
            if (! $wallet) {
                throw ValidationException::withMessages(['balance' => ['Partner wallet tidak ditemukan.']]);
            }

            $invoice = 'PTR-'.strtoupper(uniqid());
            $tx = Transaction::create([
                'user_id' => $partner->user_id,
                'invoice_number' => $invoice,
                'service_name' => 'Partner API '.$product->name,
                'target_number' => $payload['target_number'],
                'amount' => $sellPrice,
                'admin_fee' => $adminFee,
                'total_payment' => $total,
                'payment_method' => 'partner_wallet',
                'channel' => 'partner_api',
                'partner_id' => $partner->id,
                'partner_ref' => $payload['partner_ref'],
                'status' => TransactionStatus::LOCKED->value,
                'notes' => $sandbox
                    ? 'partner_api sandbox (no real debit/fulfill)'
                    : 'partner_api purchase',
                'idempotency_key' => $payload['idempotency_key'],
                'provider_response' => [
                    'channel' => 'partner_api',
                    'source' => 'partner_api',
                    'sandbox' => $sandbox,
                    'credential_id' => $credential->id,
                ],
            ]);

            TransactionItem::create([
                'transaction_id' => $tx->id,
                'product_code' => $product->sku_code,
                'product_name' => $product->name,
                'price' => $sellPrice,
                'quantity' => 1,
                'custom_metadata' => [
                    'sku' => $product->sku_code,
                    'partner_tier' => $partner->tier,
                    'base_price' => (float) $product->base_price,
                    'margin' => $sellPrice - (float) $product->base_price,
                    'admin_fee' => $adminFee,
                    'sandbox' => $sandbox,
                ],
            ]);

            if (! $sandbox) {
                $this->walletService->debitLocked($wallet, $total, (string) $tx->id);
            }

            return $tx;
        });

        if ($sandbox) {
            // No real provider fulfillment / financial webhook side effects.
            $transaction->update([
                'status' => TransactionStatus::SUCCESS->value,
                'notes' => 'partner_api sandbox simulated success',
                'completed_at' => now(),
            ]);

            return $transaction->fresh();
        }

        ProcessProductProviderTransaction::dispatch($transaction->id);

        return $transaction->fresh();
    }

    /**
     * @return array<string, mixed>
     */
    public function publicTx(Transaction $tx, bool $sandbox = false): array
    {
        return [
            'partner_ref' => $tx->partner_ref,
            'invoice_number' => $tx->invoice_number,
            'status' => $tx->status,
            'amount' => (float) $tx->amount,
            'admin_fee' => (float) $tx->admin_fee,
            'total_payment' => (float) $tx->total_payment,
            'target_number' => $tx->target_number,
            'channel' => $tx->channel,
            'sandbox' => $sandbox || (bool) data_get($tx->provider_response, 'sandbox'),
            'created_at' => optional($tx->created_at)->toIso8601String(),
        ];
    }
}
