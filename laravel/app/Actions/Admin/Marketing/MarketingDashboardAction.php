<?php

namespace App\Actions\Admin\Marketing;

use App\Repositories\Contracts\MarketingRepositoryInterface;

class MarketingDashboardAction
{
    public function __construct(
        protected MarketingRepositoryInterface $marketingRepository
    ) {}

    public function execute(): array
    {
        return $this->marketingRepository->getDashboardMetrics();
    }
}
