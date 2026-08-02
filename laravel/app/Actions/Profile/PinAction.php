<?php

namespace App\Actions\Profile;

use App\Repositories\Contracts\ProfileRepositoryInterface;
use App\Models\User;

class PinAction
{
    public function __construct(
        protected ProfileRepositoryInterface $profileRepository
    ) {}

    public function execute(User $user, string $currentPin, string $newPin): bool
    {
        return $this->profileRepository->updatePin($user, $currentPin, $newPin);
    }
}
