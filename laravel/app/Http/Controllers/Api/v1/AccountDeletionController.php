<?php

namespace App\Http\Controllers\Api\v1;

use App\Exceptions\AccountDeletionException;
use App\Http\Controllers\Controller;
use App\Services\AccountDeletion\AccountDeletionService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Customer self-serve account deletion (30-day grace). Mobile fase 1.
 */
class AccountDeletionController extends Controller
{
    use ApiResponseTrait;

    public function __construct(
        protected AccountDeletionService $deletions,
    ) {}

    public function show(Request $request): JsonResponse
    {
        try {
            $user = $request->user();
            $this->deletions->assertCustomer($user);

            return $this->successResponse('Status penghapusan akun.', $this->deletions->statusPayload($user));
        } catch (AccountDeletionException $e) {
            return $this->deletionError($e);
        }
    }

    public function store(Request $request): JsonResponse
    {
        try {
            $data = $request->validate([
                'reason_code' => 'required|string|max:64',
                'reason_text' => 'nullable|string|max:500',
                'pin' => 'required|string|regex:/^\d{6}$/',
                'pin_confirmation' => 'required|string|regex:/^\d{6}$/',
            ]);

            $result = $this->deletions->requestDeletion($request->user(), $data);

            return $this->successResponse(
                'Akun dijadwalkan dihapus. Anda masih bisa membatalkan sebelum tanggal yang ditentukan.',
                $result
            );
        } catch (AccountDeletionException $e) {
            return $this->deletionError($e);
        }
    }

    public function cancel(Request $request): JsonResponse
    {
        try {
            $data = $request->validate([
                'pin' => 'required|string|regex:/^\d{6}$/',
            ]);

            $result = $this->deletions->cancelDeletion($request->user(), $data['pin']);

            return $this->successResponse('Penghapusan akun dibatalkan. Akun kembali aktif.', $result);
        } catch (AccountDeletionException $e) {
            return $this->deletionError($e);
        }
    }

    protected function deletionError(AccountDeletionException $e): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => $e->getMessage(),
            'code' => $e->errorCode,
            'data' => null,
            'meta' => null,
            'errors' => $e->errors ?: null,
        ], $e->statusCode);
    }
}
