<?php

namespace App\Actions\Admin\Owner;

use App\Repositories\Contracts\OwnerRepositoryInterface;

class FinancialOverviewAction
{
    public function __construct(
        protected OwnerRepositoryInterface $ownerRepository
    ) {}

    public function execute(): array
    {
        return $this->ownerRepository->getFinancialOverview();
    }
}
