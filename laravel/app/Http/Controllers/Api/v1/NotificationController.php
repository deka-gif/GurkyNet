<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Models\UserNotification;
use App\Http\Resources\NotificationResource;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Carbon\Carbon;

class NotificationController extends Controller
{
    use ApiResponseTrait;

    /**
     * Get all notifications for current user.
     * GET /api/v1/notifications
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        
        $perPage = (int) $request->query('per_page', 15);
        
        $notifications = $user->userNotifications()
            ->with('notification')
            ->orderBy('created_at', 'desc')
            ->paginate($perPage);

        return $this->paginatedResponse(
            'Notifikasi berhasil dimuat.',
            NotificationResource::collection($notifications->items()),
            $notifications
        );
    }

    /**
     * Mark a single notification as read.
     * PUT /api/v1/notifications/{id}/read
     */
    public function read(Request $request, $id): JsonResponse
    {
        $user = $request->user();
        
        $userNotification = $user->userNotifications()->find($id);
        
        if (!$userNotification) {
            return $this->errorResponse('Notifikasi tidak ditemukan atau tidak diizinkan.', 404);
        }

        $userNotification->update([
            'is_read' => true,
            'read_at' => Carbon::now(),
        ]);

        return $this->successResponse(
            'Notifikasi berhasil ditandai sebagai dibaca.',
            new NotificationResource($userNotification)
        );
    }

    /**
     * Mark all notifications as read.
     * PUT /api/v1/notifications/read-all
     */
    public function readAll(Request $request): JsonResponse
    {
        $user = $request->user();
        
        $user->userNotifications()
            ->where('is_read', false)
            ->update([
                'is_read' => true,
                'read_at' => Carbon::now(),
            ]);

        return $this->successResponse('Semua notifikasi berhasil ditandai sebagai dibaca.');
    }

    /**
     * Delete a single notification.
     * DELETE /api/v1/notifications/{id}
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        $user = $request->user();
        
        $userNotification = $user->userNotifications()->find($id);
        
        if (!$userNotification) {
            return $this->errorResponse('Notifikasi tidak ditemukan atau tidak diizinkan.', 404);
        }

        $userNotification->delete();

        return $this->successResponse('Notifikasi berhasil dihapus.');
    }
}
