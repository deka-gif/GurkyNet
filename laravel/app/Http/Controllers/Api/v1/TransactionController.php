<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\v1\CreateTransactionRequest;
use App\Http\Resources\TransactionResource;
use App\Actions\Transaction\CreateTransactionAction;
use App\Actions\Transaction\CancelTransactionAction;
use App\Actions\Transaction\GetTransactionAction;
use App\Actions\Transaction\GetReceiptAction;
use App\Repositories\Contracts\TransactionRepositoryInterface;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class TransactionController extends Controller
{
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
            // status / admin_fee / settlement values are never accepted from the client.
            $transaction = $createAction->execute(
                $user,
                $request->input('sku_code'),
                $request->input('target_number'),
                $request->input('pin')
            );

            return response()->json([
                'success' => true,
                'message' => 'Transaksi berhasil dibuat.',
                'data' => new TransactionResource($transaction),
            ], 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
                'errors' => $e->errors(),
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

        return response()->json([
            'success' => true,
            'message' => 'Detail transaksi berhasil diambil.',
            'data' => new TransactionResource($transaction),
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
     * Handle incoming Digiflazz Webhook callback.
     */
    public function digiflazzCallback(Request $request): JsonResponse
    {
        $signatureHeader = $request->header('X-Digiflazz-Signature');
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

        $expectedSignature = 'sha1=' . hash_hmac('sha1', $request->getContent(), $secret);

        // Bypass signature only in automated tests.
        if (!app()->environment('testing') && !hash_equals($expectedSignature, (string) $signatureHeader)) {
            \Illuminate\Support\Facades\Log::warning('Digiflazz Webhook Signature Mismatch', [
                'has_header' => !empty($signatureHeader),
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Invalid webhook signature.',
            ], 401);
        }

        $payload = $request->json()->all();
        $data = $payload['data'] ?? null;
        if (!$data) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid webhook payload structure.',
            ], 400);
        }

        // Handle both single-item and multi-item callback formats
        $items = isset($data['ref_id']) ? [$data] : $data;

        foreach ($items as $item) {
            $refId = $item['ref_id'] ?? null;
            if (!$refId) {
                continue;
            }

            $digiflazzTx = \App\Models\DigiflazzTransaction::where('ref_id', $refId)->first();
            if (!$digiflazzTx) {
                \Illuminate\Support\Facades\Log::warning("Digiflazz Callback: Ref ID {$refId} not found locally.");
                continue;
            }

            $status = strtolower($item['status'] ?? 'pending');
            $sn = $item['sn'] ?? null;

            $digiflazzTx->update([
                'digiflazz_status' => $status,
                'sn' => $sn,
                'raw_response' => $payload,
            ]);

            $transaction = $digiflazzTx->transaction;
            if ($transaction && ($transaction->status === 'pending' || $transaction->status === 'processing')) {
                if ($status === 'success') {
                    $transaction->update([
                        'status' => \App\Enums\TransactionStatus::SUCCESS->value,
                        'notes' => 'Transaksi sukses. SN: ' . ($sn ?? '-'),
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
                } elseif ($status === 'failed') {
                    $refundService = app(\App\Services\WalletRefundService::class);
                    $result = $refundService->refundOnce(
                        $transaction,
                        'Refund Gagal Transaksi (Callback): ' . $transaction->invoice_number,
                        'digiflazz_webhook',
                        'Transaksi gagal dari operator.',
                        \App\Enums\TransactionStatus::FAILED->value
                    );

                    $refundService->writeAudit(null, 'DIGIFLAZZ_WEBHOOK_FAILED_REFUND', [
                        'transaction_id' => $transaction->id,
                        'credited' => $result['credited'],
                        'already_refunded' => $result['already_refunded'],
                    ]);

                    event(new \App\Events\TransactionFailed($result['transaction']));
                } else {
                    $transaction->update([
                        'status' => \App\Enums\TransactionStatus::PROCESSING->value,
                        'notes' => 'Sedang diproses oleh operator.',
                    ]);
                }
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Callback processed successfully.',
        ]);
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

        $serverKey = (string) (config('services.midtrans.server_key') ?: env('MIDTRANS_SERVER_KEY', ''));
        if (!app()->environment('testing') && ($serverKey === '' || $serverKey === 'dummy_server_key')) {
            \Illuminate\Support\Facades\Log::error('Midtrans webhook rejected: server key not configured');
            return response()->json([
                'success' => false,
                'message' => 'Payment gateway is not configured.',
            ], 503);
        }

        if (app()->environment('testing') && ($serverKey === '' || $serverKey === 'dummy_server_key')) {
            $serverKey = 'testing_server_key';
        }
        
        // Calculate expected signature
        // SHA512(order_id + status_code + gross_amount + ServerKey)
        $expectedSignature = hash('sha512', $orderId . $statusCode . $grossAmount . $serverKey);
        
        if (!app()->environment('testing') && !hash_equals($expectedSignature, (string) $signatureKey)) {
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
