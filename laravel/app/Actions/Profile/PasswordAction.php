<?php

namespace App\Actions\Profile;

use App\Repositories\Contracts\ProfileRepositoryInterface;
use App\Models\User;

class PasswordAction
{
    public function __construct(
        protected ProfileRepositoryInterface $profileRepository
    ) {}

    public function execute(User $user, string $currentPassword, string $newPassword): bool
    {
        return $this->profileRepository->updatePassword($user, $currentPassword, $newPassword);
    }
}
