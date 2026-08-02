<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Traits\ApiResponseTrait;
use App\Actions\Profile\ProfileAction;
use App\Actions\Profile\PasswordAction;
use App\Actions\Profile\PinAction;
use App\Actions\Profile\SecurityAction;
use App\Actions\Profile\SessionAction;
use App\Http\Requests\Profile\UpdateProfileRequest;
use App\Http\Requests\Profile\UpdatePasswordRequest;
use App\Http\Requests\Profile\UpdatePinRequest;
use App\Http\Resources\ProfileResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProfileController extends Controller
{
    use ApiResponseTrait;

    /**
     * Get user profile.
     * GET /api/v1/profile
     */
    public function show(Request $request, ProfileAction $action): JsonResponse
    {
        $user = $request->user();
        $profileData = $action->getProfile($user);

        // Wrap the profile data in our resource
        return $this->successResponse(
            'Profil pengguna berhasil dimuat.',
            new ProfileResource($user)
        );
    }

    /**
     * Update user profile.
     * PUT /api/v1/profile
     */
    public function update(UpdateProfileRequest $request, ProfileAction $action): JsonResponse
    {
        $user = $request->user();
        $updatedUser = $action->updateProfile($user, $request->validated());

        return $this->successResponse(
            'Profil pengguna berhasil diperbarui.',
            new ProfileResource($updatedUser)
        );
    }

    /**
     * Change password.
     * PUT /api/v1/profile/password
     */
    public function updatePassword(UpdatePasswordRequest $request, PasswordAction $action): JsonResponse
    {
        $user = $request->user();
        $success = $action->execute(
            $user,
            $request->input('current_password'),
            $request->input('new_password')
        );

        if (!$success) {
            return $this->errorResponse('Password saat ini salah.', 422, [
                'current_password' => ['Password saat ini salah.']
            ]);
        }

        return $this->successResponse('Password berhasil diubah.');
    }

    /**
     * Change transaction PIN.
     * PUT /api/v1/profile/pin
     */
    public function updatePin(UpdatePinRequest $request, PinAction $action): JsonResponse
    {
        $user = $request->user();
        $success = $action->execute(
            $user,
            $request->input('current_pin'),
            $request->input('new_pin')
        );

        if (!$success) {
            return $this->errorResponse('PIN transaksi saat ini salah.', 422, [
                'current_pin' => ['PIN transaksi saat ini salah.']
            ]);
        }

        return $this->successResponse('PIN transaksi berhasil diubah.');
    }

    /**
     * Get security overview.
     * GET /api/v1/profile/security
     */
    public function security(Request $request, SecurityAction $action): JsonResponse
    {
        $user = $request->user();
        $securityData = $action->execute($user);

        return $this->successResponse('Data keamanan profil berhasil dimuat.', $securityData);
    }

    /**
     * Revoke one session.
     * DELETE /api/v1/profile/sessions/{id}
     */
    public function revokeSession(Request $request, $id, SessionAction $action): JsonResponse
    {
        $user = $request->user();
        $success = $action->revokeSession($user, (int) $id);

        if (!$success) {
            return $this->errorResponse('Sesi tidak ditemukan atau gagal dihapus.', 404);
        }

        return $this->successResponse('Sesi berhasil dihapus.');
    }

    /**
     * Logout all other devices except current.
     * DELETE /api/v1/profile/sessions
     */
    public function revokeOtherSessions(Request $request, SessionAction $action): JsonResponse
    {
        $user = $request->user();
        $currentToken = $user->currentAccessToken();
        $currentTokenId = $currentToken ? $currentToken->id : '';

        $action->revokeOtherSessions($user, $currentTokenId);

        return $this->successResponse('Sesi pada perangkat lain berhasil dihapus.');
    }
}
