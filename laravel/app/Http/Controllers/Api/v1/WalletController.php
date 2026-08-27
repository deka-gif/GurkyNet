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
use App\Traits\ApiResponseTrait;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

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

    public function __construct(
        GetWalletAction $getWalletAction,
        GetWalletHistoryAction $getWalletHistoryAction,
        TopUpWalletAction $topUpWalletAction,
        TransferWalletAction $transferWalletAction,
        WithdrawWalletAction $withdrawWalletAction,
        WalletRepositoryInterface $walletRepository,
        WalletSummaryService $walletSummaryService
    ) {
        $this->getWalletAction = $getWalletAction;
        $this->getWalletHistoryAction = $getWalletHistoryAction;
        $this->topUpWalletAction = $topUpWalletAction;
        $this->transferWalletAction = $transferWalletAction;
        $this->withdrawWalletAction = $withdrawWalletAction;
        $this->walletRepository = $walletRepository;
        $this->walletSummaryService = $walletSummaryService;
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

        return $this->paginatedResponse('Histori data dompet digital berhasil didapatkan.', $history->items(), $history);
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

        return $this->successResponse('Payment config.', $config);
    }

    public function topUp(TopUpRequest $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return $this->errorResponse('Sesi Anda tidak valid.', 401);
        }

        // Sprint 8 — automatic Midtrans top-up behind feature gate (manual deposit remains).
        $gate = app(\App\Support\Features\TransactionFeatureGate::class);
        if (! $gate->autoTopupEnabled()) {
            return $this->errorResponse($gate->autoTopupDisabledMessage(), 422, [
                'amount' => [$gate->autoTopupDisabledMessage()],
            ]);
        }

        try {
            return $this->withIdempotency(
                $request,
                'POST /api/v1/wallet/topup',
                $request->only(['amount', 'admin_fee']),
                function () use ($request, $user) {
                    $amount = (float) $request->amount;
                    $adminFee = (float) $request->input('admin_fee', 0.00);
                    // Always pending — never accept client-controlled settlement status.
                    $transaction = $this->topUpWalletAction->execute(
                        $user,
                        $amount,
                        $adminFee,
                        'pending',
                        'midtrans',
                        $request->input('idempotency_key')
                    );

                    return $this->idempotentJson('Top up berhasil diajukan.', [
                        'transaction' => $transaction,
                        'snap_token' => $transaction->snap_token ?? null,
                        'redirect_url' => $transaction->redirect_url ?? null,
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
        } catch (\Illuminate\Validation\ValidationException $e) {
            return $this->errorResponse($e->getMessage(), 422, $e->errors());
        } catch (\Exception $e) {
            Log::error('Wallet topup failed: ' . $e->getMessage());
            return $this->errorResponse('Terjadi kesalahan saat memproses permintaan top up.', 500);
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
