<?php

namespace App\Http\Controllers\Api\v1;

use App\Actions\Transaction\CreateVoucherPhysicalBatchAction;
use App\Actions\Transaction\RetryVoucherPhysicalBatchItemAction;
use App\Http\Concerns\HandlesIdempotentRequests;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\v1\CreateVoucherPhysicalBatchRequest;
use App\Http\Resources\VoucherPhysicalBatchResource;
use App\Models\VoucherPhysicalBatch;
use App\Models\VoucherPhysicalBatchItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class VoucherPhysicalBatchController extends Controller
{
    use HandlesIdempotentRequests;

    /**
     * Create a Voucher Fisik bulk batch — one PIN entry, one wallet hold for the whole
     * batch. SRS 14.1 idempotency applies exactly as it does for POST /transactions.
     */
    public function store(CreateVoucherPhysicalBatchRequest $request, CreateVoucherPhysicalBatchAction $action): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized.'], 401);
        }

        try {
            return $this->withIdempotency(
                $request,
                'POST /api/v1/voucher-internet/physical-batches',
                $request->only(['sku_code', 'serials', 'pin']),
                function () use ($request, $action, $user) {
                    $batch = $action->execute(
                        $user,
                        $request->input('sku_code'),
                        $request->input('serials', []),
                        $request->input('pin'),
                        $request->input('idempotency_key')
                    );

                    return $this->idempotentJson(
                        'Batch voucher fisik berhasil dibuat.',
                        (new VoucherPhysicalBatchResource($batch))->resolve(),
                        201
                    );
                }
            );
        } catch (ValidationException $e) {
            $errors = $e->errors();
            $firstMessage = collect($errors)->flatten()->first();

            return response()->json([
                'success' => false,
                'message' => is_string($firstMessage) && $firstMessage !== '' ? $firstMessage : 'Data batch tidak valid.',
                'errors' => $errors,
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Gagal memproses batch voucher fisik: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function show(int $id, Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized.'], 401);
        }

        $batch = VoucherPhysicalBatch::with(['items', 'transaction'])->find($id);
        if (! $batch || $batch->user_id !== $user->id) {
            return response()->json(['success' => false, 'message' => 'Batch tidak ditemukan.'], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Detail batch voucher fisik berhasil diambil.',
            'data' => new VoucherPhysicalBatchResource($batch),
        ]);
    }

    public function retryItem(int $id, int $itemId, Request $request, RetryVoucherPhysicalBatchItemAction $action): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized.'], 401);
        }

        $batch = VoucherPhysicalBatch::find($id);
        if (! $batch || $batch->user_id !== $user->id) {
            return response()->json(['success' => false, 'message' => 'Batch tidak ditemukan.'], 404);
        }

        $item = VoucherPhysicalBatchItem::find($itemId);
        if (! $item || $item->batch_id !== $batch->id) {
            return response()->json(['success' => false, 'message' => 'Item tidak ditemukan.'], 404);
        }

        try {
            $item = $action->execute($user, $batch, $item);

            return response()->json([
                'success' => true,
                'message' => 'Item diantrikan ulang untuk aktivasi.',
                'data' => (new \App\Http\Resources\VoucherPhysicalBatchItemResource($item))->resolve(),
            ]);
        } catch (ValidationException $e) {
            $errors = $e->errors();
            $firstMessage = collect($errors)->flatten()->first();

            return response()->json([
                'success' => false,
                'message' => is_string($firstMessage) && $firstMessage !== '' ? $firstMessage : 'Retry gagal.',
                'errors' => $errors,
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Gagal retry item: ' . $e->getMessage(),
            ], 500);
        }
    }
}
