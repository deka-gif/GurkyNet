<?php

namespace App\Repositories\Contracts;

use App\Models\User;

interface ProfileRepositoryInterface
{
    /**
     * Get the profile data for the given user.
     */
    public function getProfileData(User $user): array;

    /**
     * Update the profile data for the given user.
     */
    public function updateProfile(User $user, array $data): User;

    /**
     * Update the password for the given user.
     */
    public function updatePassword(User $user, string $currentPassword, string $newPassword): bool;

    /**
     * Update the transaction PIN for the given user.
     */
    public function updatePin(User $user, string $currentPin, string $newPin): bool;

    /**
     * Get the security overview for the given user.
     */
    public function getSecurityOverview(User $user): array;

    /**
     * Revoke a specific token/session.
     */
    public function revokeSession(User $user, int $tokenId): bool;

    /**
     * Revoke all sessions except the current one.
     */
    public function revokeOtherSessions(User $user, string $currentTokenId): bool;
}
