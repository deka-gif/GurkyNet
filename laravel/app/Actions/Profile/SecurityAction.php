<?php

namespace App\Actions\Profile;

use App\Repositories\Contracts\ProfileRepositoryInterface;
use App\Models\User;

class SecurityAction
{
    public function __construct(
        protected ProfileRepositoryInterface $profileRepository
    ) {}

    public function execute(User $user): array
    {
        return $this->profileRepository->getSecurityOverview($user);
    }
}
