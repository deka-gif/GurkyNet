<?php

namespace App\Http\Controllers\Api\v1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\KycVerificationResource;
use App\Models\KycVerification;
use App\Services\Kyc\KycService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * FR-KYC-05 / SRS Bagian 21 — KYC review queue for Customer Service & Finance.
 */
class KycReviewController extends Controller
{
    use ApiResponseTrait;

    public function __construct(protected KycService $kycService) {}

    public function index(Request $request): JsonResponse
    {
        $status = $request->query('status', 'pending');
        $query = KycVerification::query()
            ->with('user')
            ->orderByDesc('submitted_at')
            ->orderByDesc('id');

        if ($status && $status !== 'all') {
            $query->where('status', $status);
        }

        $rows = $query->paginate(min(50, max(1, (int) $request->query('per_page', 20))));

        return $this->successResponse('Antrean KYC.', [
            'items' => $rows->getCollection()->map(function (KycVerification $row) {
                return (new KycVerificationResource($row))->additional([
                    'include_reviewer_fields' => true,
                ])->resolve();
            })->values(),
            'meta' => [
                'current_page' => $rows->currentPage(),
                'last_page' => $rows->lastPage(),
                'per_page' => $rows->perPage(),
                'total' => $rows->total(),
            ],
        ]);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $record = KycVerification::query()->with('user')->findOrFail($id);

        return $this->successResponse('Detail KYC review.', [
            'verification' => (new KycVerificationResource($record))->additional([
                'include_reviewer_fields' => true,
            ])->resolve(),
        ]);
    }

    public function approve(Request $request, int $id): JsonResponse
    {
        try {
            $record = KycVerification::query()->findOrFail($id);
            $updated = $this->kycService->approve($record, $request->user());

            return $this->successResponse('KYC disetujui.', [
                'verification' => (new KycVerificationResource($updated))->additional([
                    'include_reviewer_fields' => true,
                ])->resolve(),
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return $this->errorResponse($e->getMessage(), 422, $e->errors());
        } catch (\Throwable $e) {
            Log::error('KYC approve failed: '.$e->getMessage());

            return $this->errorResponse('Gagal menyetujui KYC.', 500);
        }
    }

    public function reject(Request $request, int $id): JsonResponse
    {
        $data = $request->validate([
            'rejection_reason' => 'required|string|min:3|max:1000',
        ]);

        try {
            $record = KycVerification::query()->findOrFail($id);
            $updated = $this->kycService->reject($record, $request->user(), $data['rejection_reason']);

            return $this->successResponse('KYC ditolak.', [
                'verification' => (new KycVerificationResource($updated))->additional([
                    'include_reviewer_fields' => true,
                ])->resolve(),
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return $this->errorResponse($e->getMessage(), 422, $e->errors());
        } catch (\Throwable $e) {
            Log::error('KYC reject failed: '.$e->getMessage());

            return $this->errorResponse('Gagal menolak KYC.', 500);
        }
    }
}
