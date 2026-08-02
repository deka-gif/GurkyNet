<?php

namespace App\Actions\Admin\Owner;

use App\Repositories\Contracts\OwnerRepositoryInterface;

class SystemHealthAction
{
    public function __construct(
        protected OwnerRepositoryInterface $ownerRepository
    ) {}

    public function execute(): array
    {
        return $this->ownerRepository->getSystemHealth();
    }
}
