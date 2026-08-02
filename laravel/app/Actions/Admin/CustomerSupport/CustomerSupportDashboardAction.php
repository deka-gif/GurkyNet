<?php

namespace App\Actions\Admin\CustomerSupport;

use App\Repositories\Contracts\CustomerSupportRepositoryInterface;

class CustomerSupportDashboardAction
{
    public function __construct(
        protected CustomerSupportRepositoryInterface $customerSupportRepository
    ) {}

    public function execute(): array
    {
        return $this->customerSupportRepository->getDashboardMetrics();
    }
}
