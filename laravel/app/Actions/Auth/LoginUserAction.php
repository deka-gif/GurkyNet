<?php

namespace App\Actions\Auth;

use App\Enums\UserRole;
use App\Models\User;
use App\Repositories\Contracts\UserRepositoryInterface;
use App\Services\Security\OtpService;
use App\Support\TokenPolicy;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class LoginUserAction
{
    /**
     * Roles yang WAJIB 2FA saat login.
     * SRS Bagian 8.1 — Sprint 2 (Authentication & RBAC), keputusan #2:
     * "Finance dan Owner WAJIB menggunakan 2FA." Role lain (termasuk
     * Super Admin) TIDAK ditambahkan karena tidak disebutkan di keputusan.
     *
     * @var list<string>
     */
    public const TWO_FACTOR_ROLES = [
        UserRole::FINANCE->value,
        UserRole::OWNER->value,
    ];

    public const TWO_FACTOR_OTP_ACTION = 'login_2fa';

    protected UserRepositoryInterface $userRepository;
    protected OtpService $otpService;

    public function __construct(UserRepositoryInterface $userRepository, OtpService $otpService)
    {
        $this->userRepository = $userRepository;
        $this->otpService = $otpService;
    }

    public function execute(string $phoneOrEmail, string $password, string $deviceIdentifier = 'default'): array
    {
        // Try finding user by email or phone number
        $user = filter_var($phoneOrEmail, FILTER_VALIDATE_EMAIL)
            ? $this->userRepository->findByEmail($phoneOrEmail)
            : $this->userRepository->findByPhone($phoneOrEmail);

        if (!$user || !Hash::check($password, $user->password)) {
            throw ValidationException::withMessages([
                'credentials' => ['Email/Nomor Handphone atau kata sandi Anda salah.'],
            ]);
        }

        if (static::requiresTwoFactor($user)) {
            return $this->challengeTwoFactor($user);
        }

        // Generate sanctum token (masa berlaku sesuai TokenPolicy — Sprint 2 keputusan #3)
        $token = $user->createToken($deviceIdentifier, ['*'], TokenPolicy::expiresAtFor($user))->plainTextToken;

        return [
            'requires_2fa' => false,
            'user' => $user->load('wallet'),
            'token' => $token,
        ];
    }

    /**
     * Terbitkan OTP 2FA (via OtpService existing, channel email) untuk role
     * Finance/Owner. TIDAK menerbitkan token — login baru selesai setelah
     * OTP diverifikasi (lihat AuthController::verifyLogin2fa()).
     */
    public function challengeTwoFactor(User $user): array
    {
        if (empty($user->email)) {
            throw ValidationException::withMessages([
                'credentials' => ['Akun ini wajib 2FA namun tidak memiliki email terdaftar. Hubungi Super Admin.'],
            ]);
        }

        $otp = $this->otpService->issue(
            $user->email,
            static::TWO_FACTOR_OTP_ACTION,
            'email',
            $user,
            [],
            5
        );

        return [
            'requires_2fa' => true,
            'identifier' => $user->email,
            'expires_at' => $otp->expires_at,
            'resend_available_at' => $otp->resend_available_at,
            'user' => $user->load('wallet'),
            'dummy_sent_code' => $otp->code,
        ];
    }

    /**
     * SRS Bagian 8.1 — Sprint 2 keputusan #2: 2FA wajib untuk role Finance & Owner.
     */
    public static function requiresTwoFactor(User $user): bool
    {
        $roleValue = $user->role instanceof UserRole ? $user->role->value : (string) $user->role;

        return in_array($roleValue, static::TWO_FACTOR_ROLES, true);
    }
}
