<?php

namespace App\Actions\Profile;

use App\Repositories\Contracts\ProfileRepositoryInterface;
use App\Models\User;

class ProfileAction
{
    public function __construct(
        protected ProfileRepositoryInterface $profileRepository
    ) {}

    public function getProfile(User $user): array
    {
        return $this->profileRepository->getProfileData($user);
    }

    public function updateProfile(User $user, array $data): User
    {
        return $this->profileRepository->updateProfile($user, $data);
    }
}
