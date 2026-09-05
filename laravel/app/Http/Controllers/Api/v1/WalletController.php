<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Http\Concerns\HandlesIdempotentRequests;
use App\Actions\Wallet\GetWalletAction;
use App\Actions\Wallet\GetWalletHistoryAction;
use App\Actions\Wallet\TopUpWalletAction;
use App\Actions\Wallet\TransferWalletAction;
use App\Actions\Wallet\WithdrawWalletAction;
use App\Actions\Wallet\CreateManualDepositAction;
use App\Http\Requests\Api\v1\TopUpRequest;
use App\Http\Requests\Api\v1\TransferRequest;
use App\Http\Requests\Api\v1\WithdrawRequest;
use App\Repositories\Contracts\WalletRepositoryInterface;
use App\Services\Wallet\WalletSummaryService;
use App\Services\Wallet\CustomerStatementService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class WalletController extends Controller
{
    use ApiResponseTrait;
    use HandlesIdempotentRequests;

    protected GetWalletAction $getWalletAction;
    protected GetWalletHistoryAction $getWalletHistoryAction;
    protected TopUpWalletAction $topUpWalletAction;
    protected TransferWalletAction $transferWalletAction;
    protected WithdrawWalletAction $withdrawWalletAction;
    protected WalletRepositoryInterface $walletRepository;
    protected WalletSummaryService $walletSummaryService;
    protected CustomerStatementService $customerStatementService;

    public function __construct(
        GetWalletAction $getWalletAction,
        GetWalletHistoryAction $getWalletHistoryAction,
        TopUpWalletAction $topUpWalletAction,
        TransferWalletAction $transferWalletAction,
        WithdrawWalletAction $withdrawWalletAction,
        WalletRepositoryInterface $walletRepository,
        WalletSummaryService $walletSummaryService,
        CustomerStatementService $customerStatementService
    ) {
        $this->getWalletAction = $getWalletAction;
        $this->getWalletHistoryAction = $getWalletHistoryAction;
        $this->topUpWalletAction = $topUpWalletAction;
        $this->transferWalletAction = $transferWalletAction;
        $this->withdrawWalletAction = $withdrawWalletAction;
        $this->walletRepository = $walletRepository;
        $this->walletSummaryService = $walletSummaryService;
        $this->customerStatementService = $customerStatementService;
    }

    /**
     * Get wallet overview for the authenticated user (balance + monthly summary + recent ledger).
     */
    public function show(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return $this->errorResponse('Sesi Anda tidak valid.', 401);
        }

        $wallet = $this->getWalletAction->execute($user->id);

        if (!$wallet) {
            return $this->errorResponse('Wallet tidak ditemukan.', 404);
        }

        // Authorize access using WalletPolicy
        if ($user->cannot('view', $wallet)) {
            return $this->errorResponse('Anda tidak diizinkan untuk mengakses dompet digital ini.', 403);
        }

        $overview = $this->walletSummaryService->buildOverview($wallet);

        return $this->successResponse('Detail data dompet digital berhasil didapatkan.', $overview);
    }

    /**
     * Get paginated wallet history with filters.
     */
    public function history(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return $this->errorResponse('Sesi Anda tidak valid.', 401);
        }

        $wallet = $this->getWalletAction->execute($user->id);

        if (!$wallet) {
            return $this->errorResponse('Wallet tidak ditemukan.', 404);
        }

        // Authorize using Policy
        if ($user->cannot('viewHistory', $wallet)) {
            return $this->errorResponse('Anda tidak diizinkan untuk mengakses histori dompet ini.', 403);
        }

        $filters = $request->only(['start_date', 'end_date', 'type', 'min_amount', 'max_amount', 'per_page']);

        $history = $this->getWalletHistoryAction->execute($wallet, $filters);

        // Enrich with service_name via batch Transaction join (same as GET /wallet recent rows).
        $enriched = $this->walletSummaryService->enrichHistoryRows($history->items());

        return $this->paginatedResponse('Histori data dompet digital berhasil didapatkan.', $enriched, $history);
    }

    /**
     * Customer monthly financial statement (JSON) — wallet_mutations SoT.
     * GET /api/v1/wallet/statements/{period}  period=YYYY-MM
     */
    public function statement(Request $request, string $period): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return $this->errorResponse('Sesi Anda tidak valid.', 401);
        }

        $wallet = $this->getWalletAction->execute($user->id);

        if (!$wallet) {
            return $this->errorResponse('Wallet tidak ditemukan.', 404);
        }

        if ($user->cannot('viewHistory', $wallet)) {
            return $this->errorResponse('Anda tidak diizinkan untuk mengakses laporan keuangan ini.', 403);
        }

        try {
            $statement = $this->customerStatementService->build($user, $wallet, $period);
        } catch (ValidationException $e) {
            return $this->errorResponse(
                collect($e->errors())->flatten()->first() ?: 'Periode tidak valid.',
                422,
                $e->errors()
            );
        }

        return $this->successResponse('Laporan keuangan berhasil didapatkan.', $statement);
    }

    /**
     * Customer monthly financial statement PDF — same DTO as JSON statement.
     * GET /api/v1/wallet/statements/{period}/pdf
     */
    public function statementPdf(Request $request, string $period)
    {
        $user = $request->user();
        if (!$user) {
            return $this->errorResponse('Sesi Anda tidak valid.', 401);
        }

        $wallet = $this->getWalletAction->execute($user->id);

        if (!$wallet) {
            return $this->errorResponse('Wallet tidak ditemukan.', 404);
        }

        if ($user->cannot('viewHistory', $wallet)) {
            return $this->errorResponse('Anda tidak diizinkan untuk mengakses laporan keuangan ini.', 403);
        }

        try {
            $statement = $this->customerStatementService->build($user, $wallet, $period);
        } catch (ValidationException $e) {
            return $this->errorResponse(
                collect($e->errors())->flatten()->first() ?: 'Periode tidak valid.',
                422,
                $e->errors()
            );
        }

        $filename = $this->customerStatementService->pdfFilename($period);

        return \Barryvdh\DomPDF\Facade\Pdf::loadView('statements.monthly', [
            'statement' => $statement,
            'period_label' => $this->customerStatementService->formatPeriodLabel($statement),
        ])->download($filename);
    }

    /**
     * Process Top Up request (Midtrans integration).
     * SRS 14.1 — idempotency_requests SoT.
     */
    /**
     * Sprint 11 — public Midtrans Snap bootstrap for authenticated users.
     * Never exposes server_key. Safe even when AUTO_TOPUP is disabled.
     */
    public function paymentConfig(): JsonResponse
    {
        $config = app(\App\Services\Payment\MidtransCredentialResolver::class)->publicConfig();
        $catalog = app(\App\Services\Payment\MidtransTopUpChannelCatalog::class)->publicCatalog();

        return $this->successResponse('Payment config.', array_merge($config, $catalog));
    }

    /**
     * User-initiated wallet top-up (FR-USR03). Not AUTO_TOPUP.
     * AUTO_TOPUP_ENABLED remains a scheduler/recurring gate and stays false.
     */
    public function topUp(TopUpRequest $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return $this->errorResponse('Sesi Anda tidak valid.', 401);
        }

        try {
            return $this->withIdempotency(
                $request,
                'POST /api/v1/wallet/topup',
                $request->only(['amount', 'admin_fee', 'payment_method', 'channel']),
                function () use ($request, $user) {
                    $amount = (float) $request->amount;
                    $adminFee = (float) $request->input('admin_fee', 0.00);
                    $paymentMethodInput = (string) $request->input('payment_method', 'qris');
                    $channelInput = $request->input('channel');
                    $channelInput = is_string($channelInput) ? $channelInput : null;

                    // Always pending — never accept client-controlled settlement status.
                    // Ownership is always the authenticated user (ignore client user_id).
                    $transaction = $this->topUpWalletAction->execute(
                        $user,
                        $amount,
                        $adminFee,
                        'pending',
                        'midtrans',
                        $request->input('idempotency_key'),
                        $paymentMethodInput,
                        $channelInput
                    );

                    return $this->idempotentJson('Top up berhasil diajukan.', [
                        'transaction' => $transaction,
                        'snap_token' => $transaction->snap_token ?? null,
                        'redirect_url' => $transaction->redirect_url ?? null,
                        'payment' => [
                            'status' => 'pending',
                            'method' => $transaction->topup_method ?? $paymentMethodInput,
                            'channel' => $transaction->topup_channel ?? $channelInput,
                            'channel_label' => $transaction->topup_channel_label ?? null,
                            'order_id' => $transaction->invoice_number,
                            'amount' => (int) $transaction->amount,
                            'va_number' => $transaction->va_number ?? null,
                            'payment_code' => $transaction->payment_code ?? null,
                            'store' => $transaction->store ?? null,
                            'expiry_time' => $transaction->expiry_time ?? null,
                        ],
                        // Sprint 11 — public Snap bootstrap (never server_key).
                        'midtrans' => app(\App\Services\Payment\MidtransCredentialResolver::class)->publicConfig(),
                    ], 201);
                }
            );
        } catch (\App\Exceptions\Payment\PaymentGatewayNotConfiguredException $e) {
            return response()->json([
                'success' => false,
                'code' => $e->errorCode(),
                'message' => $e->getMessage(),
                'data' => null,
                'meta' => null,
                'errors' => null,
            ], 503);
        } catch (\App\Exceptions\Payment\TopUpPaymentException $e) {
            return response()->json([
                'success' => false,
                'code' => $e->errorCode(),
                'message' => $e->getMessage(),
                'data' => null,
                'meta' => null,
                'errors' => null,
            ], $e->httpStatus());
        } catch (\Illuminate\Validation\ValidationException $e) {
            $message = $e->getMessage();
            $errors = $e->errors();
            $code = 'TOPUP_VALIDATION_FAILED';
            if (isset($errors['channel']) || isset($errors['payment_method'])) {
                $code = 'TOPUP_CHANNEL_UNAVAILABLE';
                $message = collect($errors)->flatten()->first() ?: $message;
            } elseif (isset($errors['amount'])) {
                $code = 'TOPUP_AMOUNT_TOO_SMALL';
                $message = collect($errors['amount'])->first() ?: $message;
            } elseif (isset($errors['idempotency_key'])) {
                $code = 'TOPUP_IDEMPOTENCY_CONFLICT';
                $message = collect($errors['idempotency_key'])->first() ?: $message;
            }

            return response()->json([
                'success' => false,
                'code' => $code,
                'message' => $message,
                'data' => null,
                'meta' => null,
                'errors' => $errors,
            ], 422);
        } catch (\Throwable $e) {
            $conflict = $this->idempotencyConflictResponse($e);
            if ($conflict) {
                return $conflict;
            }

            Log::error('Wallet topup failed: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'code' => 'TOPUP_PAYMENT_FAILED',
                'message' => 'Gagal memproses permintaan top up. Silakan coba lagi.',
                'data' => null,
                'meta' => null,
                'errors' => null,
            ], 500);
        }
    }

    /**
     * Process internal transfer (wallet to wallet).
     * SRS 14.1 — idempotency_requests SoT.
     */
    public function transfer(TransferRequest $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return $this->errorResponse('Sesi Anda tidak valid.', 401);
        }

        try {
            return $this->withIdempotency(
                $request,
                'POST /api/v1/wallet/transfer',
                $request->only(['recipient_wallet_number', 'amount', 'pin', 'admin_fee']),
                function () use ($request, $user) {
                    $recipientWalletNumber = $request->recipient_wallet_number;
                    $amount = (float) $request->amount;
                    $pin = $request->pin;

                    // Configurable fee (configurable fee rule from Sprint 13)
                    $fee = (float) $request->input('admin_fee', config('wallet.transfer_fee', 0.00));

                    $transaction = $this->transferWalletAction->execute(
                        $user,
                        $recipientWalletNumber,
                        $amount,
                        $pin,
                        $fee,
                        $request->input('idempotency_key')
                    );

                    return $this->idempotentJson('Transfer dana berhasil dikirimkan.', [
                        'transaction' => $transaction,
                    ]);
                }
            );
        } catch (\Illuminate\Validation\ValidationException $e) {
            return $this->errorResponse($e->getMessage(), 422, $e->errors());
        } catch (\Exception $e) {
            Log::error('Wallet transfer failed: ' . $e->getMessage());
            return $this->errorResponse('Terjadi kesalahan saat memproses transfer.', 500);
        }
    }

    /**
     * FR-FIN-03 — user submits manual bank-transfer deposit with proof upload.
     */
    public function depositManual(Request $request, CreateManualDepositAction $action): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return $this->errorResponse('Sesi Anda tidak valid.', 401);
        }

        $data = $request->validate([
            'amount' => 'required|numeric|min:10000',
            // Implementation detail (SRS silent): align with complaint attachment rules.
            'proof' => 'required|file|mimes:jpg,jpeg,png,pdf|max:4096',
            'notes' => 'nullable|string|max:500',
        ]);

        try {
            $row = $action->execute(
                $user,
                (float) $data['amount'],
                $request->file('proof'),
                $data['notes'] ?? null
            );

            return $this->successResponse('Permintaan deposit manual berhasil diajukan.', $row, 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return $this->errorResponse($e->getMessage(), 422, $e->errors());
        } catch (\Exception $e) {
            Log::error('Manual deposit submit failed: '.$e->getMessage());

            return $this->errorResponse('Gagal mengajukan deposit manual.', 500);
        }
    }

    /**
     * Process wallet withdrawal to bank account.
     * SRS 14.1 — idempotency_requests SoT.
     * FR-FIN-05 — holds balance and queues Finance (not immediate final debit).
     */
    public function withdraw(WithdrawRequest $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return $this->errorResponse('Sesi Anda tidak valid.', 401);
        }

        try {
            return $this->withIdempotency(
                $request,
                'POST /api/v1/wallet/withdraw',
                $request->only(['amount', 'pin', 'bank_name', 'account_number', 'admin_fee']),
                function () use ($request, $user) {
                    $transaction = $this->withdrawWalletAction->execute(
                        $user,
                        (float) $request->amount,
                        (string) $request->pin,
                        (string) $request->bank_name,
                        (string) $request->account_number,
                        (float) $request->input('admin_fee', 0),
                        $request->input('idempotency_key')
                    );

                    return $this->idempotentJson('Permintaan penarikan dana berhasil diajukan.', [
                        'transaction' => $transaction,
                    ], 201);
                }
            );
        } catch (\Illuminate\Validation\ValidationException $e) {
            return $this->errorResponse($e->getMessage(), 422, $e->errors());
        } catch (\Exception $e) {
            Log::error('Wallet withdraw failed: ' . $e->getMessage());
            return $this->errorResponse('Terjadi kesalahan saat memproses penarikan.', 500);
        }
    }
}
