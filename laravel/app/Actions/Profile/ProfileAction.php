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
        // Email changes require OTP verification — never mass-update email here.
        unset($data['email']);

        return $this->profileRepository->updateProfile($user, $data);
    }
}
