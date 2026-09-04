<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Http\Concerns\HandlesIdempotentRequests;
use App\Http\Requests\Api\v1\CreateTransactionRequest;
use App\Http\Resources\TransactionResource;
use App\Actions\Transaction\CreateTransactionAction;
use App\Actions\Transaction\CancelTransactionAction;
use App\Actions\Transaction\GetTransactionAction;
use App\Actions\Transaction\GetReceiptAction;
use App\Repositories\Contracts\TransactionRepositoryInterface;
use App\Support\Transactions\TransactionStatusMapper;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class TransactionController extends Controller
{
    use HandlesIdempotentRequests;

    protected TransactionRepositoryInterface $transactionRepository;

    public function __construct(TransactionRepositoryInterface $transactionRepository)
    {
        $this->transactionRepository = $transactionRepository;
    }

    /**
     * List transactions for the authenticated user.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized.',
            ], 401);
        }

        $filters = $request->only(['status', 'start_date', 'end_date', 'per_page']);
        $paginated = $this->transactionRepository->getPaginatedForUser($user->id, $filters);

        return response()->json([
            'success' => true,
            'message' => 'Daftar transaksi berhasil diambil.',
            'data' => TransactionResource::collection($paginated->items()),
            'meta' => [
                'current_page' => $paginated->currentPage(),
                'last_page' => $paginated->lastPage(),
                'per_page' => $paginated->perPage(),
                'total' => $paginated->total(),
            ],
        ]);
    }

    /**
     * Create a new transaction.
     * SRS 14.1 — idempotency_requests SoT via HandlesIdempotentRequests.
     */
    public function store(CreateTransactionRequest $request, CreateTransactionAction $createAction): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized.',
            ], 401);
        }

        try {
            return $this->withIdempotency(
                $request,
                'POST /api/v1/transactions',
                $request->only(['sku_code', 'target_number', 'inquiry_ref_id', 'pin']),
                function () use ($request, $createAction, $user) {
                    // status / admin_fee / settlement values are never accepted from the client.
                    $transaction = $createAction->execute(
                        $user,
                        $request->input('sku_code'),
                        $request->input('target_number'),
                        $request->input('pin'),
                        $request->input('inquiry_ref_id'),
                        $request->input('idempotency_key')
                    );

                    return $this->idempotentJson(
                        'Transaksi berhasil dibuat.',
                        (new TransactionResource($transaction))->resolve(),
                        201
                    );
                }
            );
        } catch (\Illuminate\Validation\ValidationException $e) {
            $errors = $e->errors();
            $firstMessage = collect($errors)->flatten()->first();

            return response()->json([
                'success' => false,
                'message' => is_string($firstMessage) && $firstMessage !== ''
                    ? $firstMessage
                    : 'Data transaksi tidak valid.',
                'errors' => $errors,
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Gagal memproses transaksi: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Show a transaction by ID or invoice number.
     */
    public function show(string $idOrInvoice, GetTransactionAction $getAction, Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized.',
            ], 401);
        }

        $transaction = is_numeric($idOrInvoice)
            ? $getAction->execute((int) $idOrInvoice)
            : $getAction->executeByInvoice($idOrInvoice);

        if (!$transaction || $transaction->user_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Transaksi tidak ditemukan.',
            ], 404);
        }

        // FR-TOPUP-UX-01 — owner-only payment resume (snap_token) on detail, never on list.
        $transaction->loadMissing('midtransTransaction');
        $transaction->expose_payment_resume = true;

        return response()->json([
            'success' => true,
            'message' => 'Detail transaksi berhasil diambil.',
            // resolve() avoids JsonResource nesting quirks when embedded in a custom envelope.
            'data' => (new TransactionResource($transaction))->resolve(),
        ]);
    }

    /**
     * Cancel a transaction.
     */
    public function cancel(string $idOrInvoice, GetTransactionAction $getAction, CancelTransactionAction $cancelAction, Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized.',
            ], 401);
        }

        $transaction = is_numeric($idOrInvoice)
            ? $getAction->execute((int) $idOrInvoice)
            : $getAction->executeByInvoice($idOrInvoice);

        if (!$transaction || $transaction->user_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Transaksi tidak ditemukan.',
            ], 404);
        }

        try {
            $reason = $request->input('reason');
            $canceledTransaction = $cancelAction->execute($transaction, $reason);

            return response()->json([
                'success' => true,
                'message' => 'Transaksi berhasil dibatalkan.',
                'data' => new TransactionResource($canceledTransaction),
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Gagal membatalkan transaksi: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get structured receipt.
     */
    public function receipt(string $idOrInvoice, GetTransactionAction $getAction, GetReceiptAction $receiptAction, Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized.',
            ], 401);
        }

        $transaction = is_numeric($idOrInvoice)
            ? $getAction->execute((int) $idOrInvoice)
            : $getAction->executeByInvoice($idOrInvoice);

        if (!$transaction || $transaction->user_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Transaksi tidak ditemukan.',
            ], 404);
        }

        $receipt = $receiptAction->execute($transaction);

        return response()->json([
            'success' => true,
            'message' => 'Struk transaksi berhasil dibuat.',
            'data' => $receipt,
        ]);
    }

    /**
     * Sprint 8 / FR-USR04 — download real PDF receipt (own transaction only, no mutation).
     */
    public function receiptPdf(string $idOrInvoice, GetTransactionAction $getAction, GetReceiptAction $receiptAction, Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized.',
            ], 401);
        }

        $transaction = is_numeric($idOrInvoice)
            ? $getAction->execute((int) $idOrInvoice)
            : $getAction->executeByInvoice($idOrInvoice);

        if (!$transaction || $transaction->user_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Transaksi tidak ditemukan.',
            ], 404);
        }

        $receipt = $receiptAction->execute($transaction);
        $filename = 'struk-'.preg_replace('/[^A-Za-z0-9\-_]/', '', (string) $transaction->invoice_number).'.pdf';

        return \Barryvdh\DomPDF\Facade\Pdf::loadView('receipts.transaction', [
            'receipt' => $receipt,
            'transaction' => $transaction,
        ])->download($filename);
    }

    /**
     * Handle incoming Digiflazz Webhook callback.
     *
     * Official Digiflazz docs (Webhooks.pdf):
     * - Signature header: X-Hub-Signature = sha1=HMAC-SHA1(rawBody, secret)
     * - X-Digiflazz-Signature is accepted only as legacy compatibility.
     * - Events: create | update | resend (+ ping payload without transaction data)
     */
    public function digiflazzCallback(Request $request): JsonResponse
    {
        $secret = (string) (
            config('services.digiflazz.webhook_secret')
            ?: env('DIGIFLAZZ_WEBHOOK_SECRET')
            ?: config('services.digiflazz.secret')
            ?: env('DIGIFLAZZ_SECRET')
            ?: env('DIGIFLAZZ_API_KEY')
            ?: ''
        );

        if ($secret === '' || $secret === 'dummy_api_key') {
            if (app()->environment('testing')) {
                $secret = 'testing_webhook_secret';
            } else {
                \Illuminate\Support\Facades\Log::error('Digiflazz webhook rejected: secret not configured');

                return response()->json([
                    'success' => false,
                    'message' => 'Webhook secret is not configured.',
                ], 503);
            }
        }

        $rawBody = $request->getContent();
        $expectedSignature = 'sha1='.hash_hmac('sha1', $rawBody, $secret);

        // Official Digiflazz header (Webhooks.pdf).
        $hubSignature = (string) $request->header('X-Hub-Signature', '');
        // Legacy compatibility only — older GurkyNet clients/tests used X-Digiflazz-Signature.
        $legacySignature = (string) $request->header('X-Digiflazz-Signature', '');

        $providedSignature = $hubSignature !== '' ? $hubSignature : $legacySignature;
        $signatureSource = $hubSignature !== '' ? 'X-Hub-Signature' : ($legacySignature !== '' ? 'X-Digiflazz-Signature' : 'none');

        if ($providedSignature === '' || ! hash_equals($expectedSignature, $providedSignature)) {
            \Illuminate\Support\Facades\Log::warning('Digiflazz Webhook Signature Mismatch', [
                'signature_source' => $signatureSource,
                'has_hub_signature' => $hubSignature !== '',
                'has_legacy_signature' => $legacySignature !== '',
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Invalid webhook signature.',
            ], 401);
        }

        $event = strtolower(trim((string) $request->header('X-Digiflazz-Event', '')));
        $userAgent = (string) $request->header('User-Agent', '');
        $agentClass = $this->classifyDigiflazzWebhookUserAgent($userAgent);

        \Illuminate\Support\Facades\Log::info('Digiflazz webhook received', [
            'event' => $event !== '' ? $event : null,
            'user_agent' => $userAgent !== '' ? $userAgent : null,
            'user_agent_class' => $agentClass,
            'signature_source' => $signatureSource,
            'signature_valid' => true,
        ]);

        $payload = $request->json()->all();
        if (! is_array($payload)) {
            $payload = [];
        }

        // Ping Event (Webhooks.pdf): sed + hook_id + hook — not a transaction callback.
        if ($this->isDigiflazzWebhookPing($payload)) {
            \Illuminate\Support\Facades\Log::info('Digiflazz webhook ping', [
                'event' => $event !== '' ? $event : 'ping',
                'hook_id' => $payload['hook_id'] ?? null,
                'user_agent_class' => $agentClass,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Webhook ping acknowledged.',
            ], 200);
        }

        $data = $payload['data'] ?? null;
        if (! $data) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid webhook payload structure.',
            ], 400);
        }

        // Handle both single-item and multi-item callback formats
        $items = isset($data['ref_id']) ? [$data] : $data;
        if (! is_array($items)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid webhook payload structure.',
            ], 400);
        }

        foreach ($items as $item) {
            if (! is_array($item)) {
                continue;
            }

            $refId = $item['ref_id'] ?? null;
            if (! $refId) {
                continue;
            }

            $digiflazzTx = \App\Models\DigiflazzTransaction::where('ref_id', $refId)->first();
            if (! $digiflazzTx) {
                \Illuminate\Support\Facades\Log::warning('Digiflazz Callback: Ref ID not found locally.', [
                    'ref_id' => $refId,
                    'event' => $event !== '' ? $event : null,
                ]);
                continue;
            }

            $normalizedStatus = $this->normalizeDigiflazzWebhookStatus($item['status'] ?? null);
            $sn = isset($item['sn']) && $item['sn'] !== '' ? (string) $item['sn'] : null;
            $rcClassifier = \App\Services\ProductProviders\DigiflazzResponseCodeClassifier::fromResponseData($item);

            \Illuminate\Support\Facades\Log::info('Digiflazz webhook RC classified', array_merge(
                [
                    'ref_id' => $refId,
                    'event' => $event !== '' ? $event : null,
                    'status' => $normalizedStatus,
                ],
                $rcClassifier->toLogContext()
            ));

            $mirrorAttributes = \App\Services\DigiflazzService::digiflazzTransactionAttributesFromResponse(
                $normalizedStatus,
                ['data' => $item],
                $sn
            );
            $mirrorAttributes['raw_response'] = array_merge(
                is_array($payload) ? $payload : [],
                [
                    '_gurky_webhook' => [
                        'event' => $event !== '' ? $event : null,
                        'user_agent' => $userAgent !== '' ? $userAgent : null,
                        'user_agent_class' => $agentClass,
                    ],
                ]
            );
            $digiflazzTx->update($mirrorAttributes);

            $transaction = $digiflazzTx->transaction;
            if (! $transaction) {
                continue;
            }

            $inFlight = TransactionStatusMapper::isFulfillOpen($transaction->status);
            if (! $inFlight) {
                \Illuminate\Support\Facades\Log::info('Digiflazz webhook duplicate — transaction already terminal', [
                    'ref_id' => $refId,
                    'event' => $event !== '' ? $event : null,
                    'transaction_id' => $transaction->id,
                    'transaction_status' => $transaction->status,
                    'webhook_status' => $normalizedStatus,
                ]);
                continue;
            }

            if ($normalizedStatus === 'success') {
                $transaction->update([
                    'status' => \App\Enums\TransactionStatus::SUCCESS->value,
                    'notes' => 'Transaksi sukses. SN: '.($sn ?? $digiflazzTx->fresh()?->sn ?? '-'),
                ]);

                \App\Models\PaymentHistory::recordFor(
                    $transaction,
                    'digiflazz',
                    'success',
                    $payload,
                    $item,
                    $transaction->invoice_number
                );

                event(new \App\Events\TransactionSuccess($transaction));
                event(new \App\Events\PaymentSettled($transaction, is_array($payload) ? $payload : []));
            } elseif ($normalizedStatus === 'failed') {
                $refundService = app(\App\Services\WalletRefundService::class);
                $failNote = $rcClassifier->category === \App\Services\ProductProviders\DigiflazzResponseCodeClassifier::REFUND
                    || $rcClassifier->isRefundable()
                    ? 'Transaksi gagal/refund dari operator (RC '.$rcClassifier->code.').'
                    : 'Transaksi gagal dari operator.';

                $result = $refundService->refundOnce(
                    $transaction,
                    'Refund Gagal Transaksi (Callback): '.$transaction->invoice_number,
                    'digiflazz_webhook',
                    $failNote,
                    \App\Enums\TransactionStatus::FAILED->value
                );

                $refundService->writeAudit(null, 'DIGIFLAZZ_WEBHOOK_FAILED_REFUND', [
                    'transaction_id' => $transaction->id,
                    'credited' => $result['credited'],
                    'already_refunded' => $result['already_refunded'],
                    // RC metadata distinguishes Digiflazz-created vs never-created for audit accuracy.
                    'digiflazz_rc' => $rcClassifier->code,
                    'digiflazz_rc_category' => $rcClassifier->category,
                    'digiflazz_should_refund' => $rcClassifier->shouldRefund,
                    'digiflazz_transaction_created' => $rcClassifier->transactionCreated,
                ]);

                event(new \App\Events\TransactionFailed($result['transaction']));
            } else {
                // SRS 14.3 — unclear supplier outcome → PENDING_SUPPLIER
                $transaction->update([
                    'status' => \App\Enums\TransactionStatus::PENDING_SUPPLIER->value,
                    'notes' => 'Sedang diproses oleh operator.',
                ]);
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Callback processed successfully.',
        ]);
    }

    /**
     * Digiflazz ping payload shape (Webhooks.pdf).
     *
     * @param  array<string, mixed>  $payload
     */
    protected function isDigiflazzWebhookPing(array $payload): bool
    {
        return array_key_exists('sed', $payload)
            && array_key_exists('hook_id', $payload)
            && array_key_exists('hook', $payload);
    }

    /**
     * Normalize Digiflazz webhook status strings to GurkyNet success|failed|pending.
     */
    protected function normalizeDigiflazzWebhookStatus(mixed $status): string
    {
        $normalized = strtolower(trim((string) $status));

        if (in_array($normalized, ['sukses', 'success'], true)) {
            return 'success';
        }

        if (in_array($normalized, ['gagal', 'failed', 'failure'], true)) {
            return 'failed';
        }

        if (in_array($normalized, ['pending', 'process', 'processing'], true)) {
            return 'pending';
        }

        return 'pending';
    }

    /**
     * Classify Digiflazz User-Agent for logging only (does not change business flow).
     */
    protected function classifyDigiflazzWebhookUserAgent(string $userAgent): string
    {
        return match (true) {
            str_contains($userAgent, 'Digiflazz-Pasca-Hookshot') => 'postpaid',
            str_contains($userAgent, 'Digiflazz-Hotel-Hookshot') => 'hotel',
            str_contains($userAgent, 'Digiflazz-Hookshot') => 'prepaid',
            default => 'unknown',
        };
    }

    /**
     * Handle incoming VIPayment / VIP Reseller prepaid webhook (VIPayment API Prepaid.pdf).
     *
     * Validates X-Client-Signature = md5(API ID + API KEY). Polling remains the primary
     * pending path; this callback is an optional additional settlement channel.
     */
    public function vipCallback(Request $request): JsonResponse
    {
        $vip = app(\App\Services\VipService::class);
        $expectedSignature = $vip->expectedWebhookSignature();
        $providedSignature = trim((string) $request->header('X-Client-Signature', ''));

        if ($expectedSignature === '' || $providedSignature === '' || ! hash_equals($expectedSignature, $providedSignature)) {
            \Illuminate\Support\Facades\Log::warning('VIP Webhook Signature Mismatch', [
                'has_signature_header' => $providedSignature !== '',
                'credentials_configured' => $expectedSignature !== '',
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Invalid webhook signature.',
            ], 401);
        }

        $payload = $request->json()->all();
        if (! is_array($payload)) {
            $payload = $request->all();
        }
        if (! is_array($payload)) {
            $payload = [];
        }

        $items = $this->extractVipWebhookItems($payload);
        if ($items === []) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid webhook payload structure.',
            ], 400);
        }

        \Illuminate\Support\Facades\Log::info('VIP webhook received', [
            'item_count' => count($items),
            'signature_valid' => true,
        ]);

        foreach ($items as $item) {
            $trxid = trim((string) ($item['trxid'] ?? ''));
            if ($trxid === '') {
                continue;
            }

            $rawStatus = strtolower(trim((string) ($item['status'] ?? '')));
            $normalized = \App\Services\ProductProviders\VipOrderPayload::normalizeStatus($rawStatus);
            $note = trim((string) ($item['note'] ?? ''));
            $sn = $note !== '' ? $note : null;

            \Illuminate\Support\Facades\Log::info('VIP webhook item classified', [
                'trxid' => $trxid,
                'data' => $item['data'] ?? null,
                'service' => $item['service'] ?? null,
                'status' => $rawStatus !== '' ? $rawStatus : null,
                'normalized_status' => $normalized,
                'note' => $note !== '' ? $note : null,
                'price' => $item['price'] ?? null,
            ]);

            $transaction = \App\Models\Transaction::query()
                ->where('provider_ref', $trxid)
                ->where(function ($q) {
                    $q->where('fulfillment_provider_code', \App\Models\ProductProvider::CODE_VIP)
                        ->orWhereNull('fulfillment_provider_code');
                })
                ->first();

            if (! $transaction) {
                \Illuminate\Support\Facades\Log::warning('VIP webhook: trxid not found locally.', [
                    'trxid' => $trxid,
                ]);
                continue;
            }

            $inFlight = TransactionStatusMapper::isFulfillOpen($transaction->status);
            if (! $inFlight) {
                \Illuminate\Support\Facades\Log::info('VIP webhook duplicate — transaction already terminal', [
                    'trxid' => $trxid,
                    'transaction_id' => $transaction->id,
                    'transaction_status' => $transaction->status,
                    'webhook_status' => $rawStatus,
                ]);
                continue;
            }

            $transaction->forceFill([
                'fulfillment_provider_code' => $transaction->fulfillment_provider_code ?: \App\Models\ProductProvider::CODE_VIP,
                'provider_response' => $payload,
                'provider_last_status' => $normalized,
                'provider_checked_at' => now(),
            ])->save();

            if ($normalized === 'success') {
                $transaction->update([
                    'status' => \App\Enums\TransactionStatus::SUCCESS->value,
                    'notes' => 'Transaksi sukses. SN: '.($sn ?? '-'),
                ]);

                \App\Models\PaymentHistory::recordFor(
                    $transaction,
                    'vip',
                    'success',
                    $payload,
                    $item,
                    $transaction->invoice_number
                );

                event(new \App\Events\TransactionSuccess($transaction->fresh(['user']) ?? $transaction));
                event(new \App\Events\PaymentSettled($transaction->fresh(['user']) ?? $transaction, $payload));
            } elseif ($normalized === 'failed') {
                $refundService = app(\App\Services\WalletRefundService::class);
                $failNote = $note !== ''
                    ? 'Transaksi gagal dari operator: '.$note
                    : 'Transaksi gagal dari operator.';

                $result = $refundService->refundOnce(
                    $transaction,
                    'Refund Gagal Transaksi (VIP Callback): '.$transaction->invoice_number,
                    'vip_webhook',
                    $failNote,
                    \App\Enums\TransactionStatus::FAILED->value
                );

                $refundService->writeAudit(null, 'VIP_WEBHOOK_FAILED_REFUND', [
                    'transaction_id' => $transaction->id,
                    'trxid' => $trxid,
                    'credited' => $result['credited'],
                    'already_refunded' => $result['already_refunded'],
                    'vip_status' => $rawStatus,
                ]);

                event(new \App\Events\TransactionFailed($result['transaction']));
            } else {
                // SRS 14.3 — unclear supplier outcome → PENDING_SUPPLIER; polling may still resolve later.
                $transaction->update([
                    'status' => \App\Enums\TransactionStatus::PENDING_SUPPLIER->value,
                    'notes' => 'Sedang diproses oleh operator.',
                ]);
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Callback processed successfully.',
        ]);
    }

    /**
     * VIP Prepaid.pdf shows both a flat field table and an envelope example with data[].
     *
     * @param  array<string, mixed>  $payload
     * @return list<array<string, mixed>>
     */
    protected function extractVipWebhookItems(array $payload): array
    {
        $data = $payload['data'] ?? null;

        if (is_array($data) && $data !== []) {
            if (array_is_list($data)) {
                return array_values(array_filter($data, 'is_array'));
            }

            if (array_key_exists('trxid', $data)) {
                return [$data];
            }
        }

        if (array_key_exists('trxid', $payload)) {
            return [$payload];
        }

        return [];
    }

    /**
     * Handle incoming Midtrans Webhook callback.
     */
    public function midtransCallback(Request $request): JsonResponse
    {
        $payload = $request->all();
        
        $orderId = $payload['order_id'] ?? null;
        $statusCode = $payload['status_code'] ?? null;
        $grossAmount = $payload['gross_amount'] ?? null;
        $signatureKey = $payload['signature_key'] ?? null;
        
        if (!$orderId || !$statusCode || !$grossAmount || !$signatureKey) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid callback payload structure.',
            ], 400);
        }

        $serverKey = app(\App\Services\Payment\MidtransCredentialResolver::class)->resolve()['server_key'];
        $isTestRuntime = app()->runningUnitTests() || app()->environment('testing');

        if (!$isTestRuntime && ($serverKey === '' || $serverKey === 'dummy_server_key')) {
            \Illuminate\Support\Facades\Log::error('Midtrans webhook rejected: server key not configured');
            return response()->json([
                'success' => false,
                'message' => 'Payment gateway is not configured.',
            ], 503);
        }

        if ($isTestRuntime && ($serverKey === '' || $serverKey === 'dummy_server_key')) {
            $serverKey = 'testing_server_key';
        }
        
        // Calculate expected signature — SRS 16.5 / Bagian 24 #8.
        // SHA512(order_id + status_code + gross_amount + ServerKey)
        // Always verified (including tests) so forged signatures cannot credit wallets.
        $expectedSignature = hash('sha512', $orderId . $statusCode . $grossAmount . $serverKey);

        if (!hash_equals($expectedSignature, (string) $signatureKey)) {
            \Illuminate\Support\Facades\Log::warning('Midtrans Webhook Signature Mismatch', [
                'order_id' => $orderId,
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Invalid webhook signature.',
            ], 401);
        }

        // Dispatch background processing job
        \App\Jobs\ProcessMidtransCallback::dispatch($payload);

        return response()->json([
            'success' => true,
            'message' => 'Callback processed successfully.',
        ]);
    }
}
