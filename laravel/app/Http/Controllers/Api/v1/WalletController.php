<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\v1\TopUpRequest;
use App\Http\Requests\Api\v1\TransferRequest;
use App\Actions\Wallet\GetWalletAction;
use App\Actions\Wallet\GetWalletHistoryAction;
use App\Actions\Wallet\TopUpWalletAction;
use App\Actions\Wallet\TransferWalletAction;
use App\Repositories\Contracts\WalletRepositoryInterface;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Gate;

class WalletController extends Controller
{
    use ApiResponseTrait;

    protected GetWalletAction $getWalletAction;
    protected GetWalletHistoryAction $getWalletHistoryAction;
    protected TopUpWalletAction $topUpWalletAction;
    protected TransferWalletAction $transferWalletAction;
    protected WalletRepositoryInterface $walletRepository;

    public function __construct(
        GetWalletAction $getWalletAction,
        GetWalletHistoryAction $getWalletHistoryAction,
        TopUpWalletAction $topUpWalletAction,
        TransferWalletAction $transferWalletAction,
        WalletRepositoryInterface $walletRepository
    ) {
        $this->getWalletAction = $getWalletAction;
        $this->getWalletHistoryAction = $getWalletHistoryAction;
        $this->topUpWalletAction = $topUpWalletAction;
        $this->transferWalletAction = $transferWalletAction;
        $this->walletRepository = $walletRepository;
    }

    /**
     * Get wallet details for the authenticated user.
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

        return $this->successResponse('Detail data dompet digital berhasil didapatkan.', new \App\Http\Resources\WalletResource($wallet));
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
     */
    public function topUp(TopUpRequest $request): JsonResponse
    {
        try {
            $user = $request->user();
            if (!$user) {
                return $this->errorResponse('Sesi Anda tidak valid.', 401);
            }

            $amount = (float) $request->amount;
            $adminFee = (float) $request->input('admin_fee', 0.00);
            $status = $request->input('status', 'pending'); // Defaults to pending for Midtrans integration

            $transaction = $this->topUpWalletAction->execute($user, $amount, $adminFee, $status);

            return $this->successResponse('Top up berhasil diajukan.', [
                'transaction' => $transaction,
                'snap_token' => $transaction->snap_token ?? null,
                'redirect_url' => $transaction->redirect_url ?? null,
            ], 201);
        } catch (\Exception $e) {
            Log::error('Wallet topup failed: ' . $e->getMessage());
            return $this->errorResponse('Terjadi kesalahan saat memproses permintaan top up.', 500);
        }
    }

    /**
     * Process internal transfer (wallet to wallet).
     */
    public function transfer(TransferRequest $request): JsonResponse
    {
        try {
            $user = $request->user();
            if (!$user) {
                return $this->errorResponse('Sesi Anda tidak valid.', 401);
            }

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
                $fee
            );

            return $this->successResponse('Transfer dana berhasil dikirimkan.', [
                'transaction' => $transaction,
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return $this->errorResponse($e->getMessage(), 422, $e->errors());
        } catch (\Exception $e) {
            Log::error('Wallet transfer failed: ' . $e->getMessage());
            return $this->errorResponse('Terjadi kesalahan saat memproses transfer.', 500);
        }
    }
}
