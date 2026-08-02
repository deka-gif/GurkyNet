<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\v1\RegisterRequest;
use App\Http\Requests\Api\v1\LoginRequest;
use App\Http\Requests\Api\v1\VerifyOtpRequest;
use App\Http\Requests\Api\v1\ResetPasswordRequest;
use App\Http\Requests\Api\v1\ChangePinRequest;
use App\Actions\Auth\RegisterUserAction;
use App\Actions\Auth\LoginUserAction;
use App\Actions\Auth\LogoutUserAction;
use App\Actions\Auth\VerifyOtpAction;
use App\Actions\Auth\ResetPasswordAction;
use App\Actions\Auth\ChangePinAction;
use App\Repositories\Contracts\OtpRepositoryInterface;
use App\Repositories\Contracts\UserRepositoryInterface;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

class AuthController extends Controller
{
    use ApiResponseTrait;

    protected RegisterUserAction $registerAction;
    protected LoginUserAction $loginAction;
    protected LogoutUserAction $logoutAction;
    protected VerifyOtpAction $verifyOtpAction;
    protected ResetPasswordAction $resetPasswordAction;
    protected ChangePinAction $changePinAction;
    protected OtpRepositoryInterface $otpRepository;
    protected UserRepositoryInterface $userRepository;

    public function __construct(
        RegisterUserAction $registerAction,
        LoginUserAction $loginAction,
        LogoutUserAction $logoutAction,
        VerifyOtpAction $verifyOtpAction,
        ResetPasswordAction $resetPasswordAction,
        ChangePinAction $changePinAction,
        OtpRepositoryInterface $otpRepository,
        UserRepositoryInterface $userRepository
    ) {
        $this->registerAction = $registerAction;
        $this->loginAction = $loginAction;
        $this->logoutAction = $logoutAction;
        $this->verifyOtpAction = $verifyOtpAction;
        $this->resetPasswordAction = $resetPasswordAction;
        $this->changePinAction = $changePinAction;
        $this->otpRepository = $otpRepository;
        $this->userRepository = $userRepository;
    }

    /**
     * Handle User Registration.
     */
    public function register(RegisterRequest $request): JsonResponse
    {
        try {
            $user = $this->registerAction->execute($request->validated());
            
            return $this->successResponse('Registrasi pengguna berhasil dilakukan.', [
                'user' => new \App\Http\Resources\ProfileResource($user),
            ], 201);
        } catch (\Exception $e) {
            Log::error('Registration failed: ' . $e->getMessage());
            return $this->errorResponse('Terjadi kesalahan saat registrasi. Silakan coba lagi.', 500);
        }
    }

    /**
     * Handle User Login.
     */
    public function login(LoginRequest $request): JsonResponse
    {
        try {
            $device = $request->header('User-Agent', 'Default-Device');
            $result = $this->loginAction->execute(
                $request->phone_or_email,
                $request->password,
                $device
            );

            $result['user'] = new \App\Http\Resources\ProfileResource($result['user']);

            return $this->successResponse('Login berhasil dilakukan.', $result);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return $this->errorResponse($e->getMessage(), 422, $e->errors());
        } catch (\Exception $e) {
            Log::error('Login failed: ' . $e->getMessage());
            return $this->errorResponse('Terjadi kesalahan saat mencoba masuk.', 500);
        }
    }

    /**
     * Get Current Authenticated User & Wallet.
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return $this->errorResponse('Sesi Anda telah kedaluwarsa atau tidak valid.', 401);
        }

        return $this->successResponse('Detail data pengguna berhasil didapatkan.', [
            'user' => new \App\Http\Resources\ProfileResource($user),
        ]);
    }

    /**
     * Refresh Authentication Session.
     */
    public function refresh(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return $this->errorResponse('Sesi Anda telah kedaluwarsa.', 401);
        }

        // Revoke current token and generate a new one
        $user->currentAccessToken()->delete();
        $device = $request->header('User-Agent', 'Refreshed-Device');
        $newToken = $user->createToken($device)->plainTextToken;

        return $this->successResponse('Token otentikasi berhasil diperbarui.', [
            'user' => new \App\Http\Resources\ProfileResource($user),
            'token' => $newToken,
        ]);
    }

    /**
     * Handle Logout.
     */
    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return $this->errorResponse('Sesi Anda telah kedaluwarsa atau tidak valid.', 401);
        }

        $this->logoutAction->execute($user);
        return $this->successResponse('Logout berhasil dilakukan.');
    }

    /**
     * Generate & Request OTP Code (Dummy Sender Implementation).
     */
    public function requestOtp(Request $request): JsonResponse
    {
        $request->validate([
            'phone_number' => 'required|string|regex:/^08[0-9]{8,11}$/',
            'action' => 'required|string|in:registration,pin_reset,password_reset,verification',
        ], [
            'phone_number.regex' => 'Format nomor handphone tidak valid.',
            'action.in' => 'Format aksi OTP tidak valid.',
        ]);

        $phone = $request->phone_number;
        $action = $request->action;

        // For registration or verification, check if number already exists
        if ($action === 'registration' && $this->userRepository->findByPhone($phone)) {
            return $this->errorResponse('Nomor handphone sudah terdaftar di sistem.', 409);
        }

        // Create 6-digit random code
        $code = str_pad((string)mt_rand(100000, 999999), 6, '0', STR_PAD_LEFT);

        // Save in OTP records
        $this->otpRepository->create($phone, $code, $action, 5); // 5 minutes expiry

        // Dummy sender log representation
        Log::info("OTP Code [{$code}] generated for {$phone} action: {$action}");

        return $this->successResponse('Kode OTP berhasil dikirim.', [
            'phone_number' => $phone,
            'action' => $action,
            'dummy_sent_code' => $code, // Display code in response for sandbox testing ease
            'expires_at' => now()->addMinutes(5)->toIso8601String(),
        ]);
    }

    /**
     * Verify OTP Code.
     */
    public function verifyOtp(VerifyOtpRequest $request): JsonResponse
    {
        try {
            $this->verifyOtpAction->execute(
                $request->phone_number,
                $request->code,
                $request->action
            );

            return $this->successResponse('Kode OTP berhasil diverifikasi.', [
                'phone_number' => $request->phone_number,
                'action' => $request->action,
                'verified' => true,
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return $this->errorResponse($e->getMessage(), 422, $e->errors());
        } catch (\Exception $e) {
            Log::error('OTP verification failed: ' . $e->getMessage());
            return $this->errorResponse('Terjadi kesalahan saat memverifikasi OTP.', 500);
        }
    }

    /**
     * Reset Password via OTP Code validation.
     */
    public function resetPassword(ResetPasswordRequest $request): JsonResponse
    {
        try {
            $this->resetPasswordAction->execute(
                $request->phone_number,
                $request->otp_code,
                $request->password
            );

            return $this->successResponse('Kata sandi Anda berhasil diperbarui. Silakan login kembali.');
        } catch (\Illuminate\Validation\ValidationException $e) {
            return $this->errorResponse($e->getMessage(), 422, $e->errors());
        } catch (\Exception $e) {
            Log::error('Password reset failed: ' . $e->getMessage());
            return $this->errorResponse('Terjadi kesalahan saat memperbarui kata sandi.', 500);
        }
    }

    /**
     * Set or Change Transaction PIN (6-digit hashed).
     */
    public function changePin(ChangePinRequest $request): JsonResponse
    {
        try {
            $user = $request->user();
            if (!$user) {
                return $this->errorResponse('Sesi Anda tidak valid.', 401);
            }

            $this->changePinAction->execute(
                $user,
                $request->new_pin,
                $request->old_pin
            );

            return $this->successResponse('PIN transaksi Anda berhasil diperbarui.');
        } catch (\Illuminate\Validation\ValidationException $e) {
            return $this->errorResponse($e->getMessage(), 422, $e->errors());
        } catch (\Exception $e) {
            Log::error('PIN modification failed: ' . $e->getMessage());
            return $this->errorResponse('Terjadi kesalahan saat memproses PIN transaksi Anda.', 500);
        }
    }
}
