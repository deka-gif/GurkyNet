<?php

namespace App\Actions\Profile;

use App\Repositories\Contracts\ProfileRepositoryInterface;
use App\Models\User;

class SessionAction
{
    public function __construct(
        protected ProfileRepositoryInterface $profileRepository
    ) {}

    public function revokeSession(User $user, int $tokenId): bool
    {
        return $this->profileRepository->revokeSession($user, $tokenId);
    }

    public function revokeOtherSessions(User $user, string $currentTokenId): bool
    {
        return $this->profileRepository->revokeOtherSessions($user, $currentTokenId);
    }
}
