<?php

namespace App\Http\Controllers\Api\v1;

use App\Actions\Auth\ChangePinAction;
use App\Actions\Auth\VerifyOtpAction;
use App\Http\Controllers\Controller;
use App\Http\Resources\ProfileResource;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class AccountController extends Controller
{
    use ApiResponseTrait;

    /**
     * POST /api/v1/profile/avatar
     */
    public function uploadAvatar(Request $request): JsonResponse
    {
        $data = $request->validate([
            'avatar' => 'required|image|mimes:jpg,jpeg,png,webp|max:2048',
        ]);

        $user = $request->user();
        $file = $data['avatar'];
        $path = $file->store('avatars/' . $user->id, 'public');

        if ($user->avatar_path && Storage::disk('public')->exists($user->avatar_path)) {
            Storage::disk('public')->delete($user->avatar_path);
        }

        $user->forceFill(['avatar_path' => $path])->save();

        return $this->successResponse(
            'Foto profil berhasil diperbarui.',
            new ProfileResource($user->fresh(['wallet']))
        );
    }

    /**
     * POST /api/v1/pin/create — first-time PIN only.
     */
    public function createPin(Request $request, ChangePinAction $action): JsonResponse
    {
        $data = $request->validate([
            'pin' => 'required|string|regex:/^\d{6}$/',
            'pin_confirmation' => 'required|same:pin',
        ]);

        $user = $request->user();
        if ($user->hasPin()) {
            throw ValidationException::withMessages([
                'pin' => ['PIN transaksi sudah diatur. Gunakan ganti PIN.'],
            ]);
        }

        $action->execute($user, $data['pin'], null);

        return $this->successResponse(
            'PIN transaksi berhasil dibuat.',
            new ProfileResource($user->fresh(['wallet']))
        );
    }

    /**
     * PUT /api/v1/pin/change
     */
    public function changePin(Request $request, ChangePinAction $action): JsonResponse
    {
        $data = $request->validate([
            'old_pin' => 'required|string|regex:/^\d{6}$/',
            'pin' => 'required|string|regex:/^\d{6}$/',
            'pin_confirmation' => 'required|same:pin',
        ]);

        $user = $request->user();
        if (!$user->hasPin()) {
            throw ValidationException::withMessages([
                'pin' => ['Anda belum memiliki PIN. Buat PIN terlebih dahulu.'],
            ]);
        }

        $action->execute($user, $data['pin'], $data['old_pin']);

        return $this->successResponse(
            'PIN transaksi berhasil diubah.',
            new ProfileResource($user->fresh(['wallet']))
        );
    }

    /**
     * POST /api/v1/pin/forgot — OTP pin_reset then set new PIN.
     */
    public function forgotPin(Request $request, VerifyOtpAction $verifyOtp, ChangePinAction $changePin): JsonResponse
    {
        $data = $request->validate([
            'phone_number' => 'required|string',
            'otp' => 'required|string',
            'pin' => 'required|string|regex:/^\d{6}$/',
            'pin_confirmation' => 'required|same:pin',
        ]);

        $user = $request->user();
        $phone = preg_replace('/\D+/', '', $data['phone_number']) ?: $user->phone_number;

        if ($phone !== preg_replace('/\D+/', '', (string) $user->phone_number)) {
            throw ValidationException::withMessages([
                'phone_number' => ['Nomor HP tidak sesuai dengan akun Anda.'],
            ]);
        }

        $verifyOtp->execute($phone, $data['otp'], 'pin_reset');

        // Force-set without old PIN after OTP verified.
        $user->forceFill([
            'transaction_pin' => Hash::make($data['pin']),
            'pin_updated_at' => now(),
        ])->save();

        return $this->successResponse(
            'PIN transaksi berhasil diatur ulang.',
            new ProfileResource($user->fresh(['wallet']))
        );
    }
}
