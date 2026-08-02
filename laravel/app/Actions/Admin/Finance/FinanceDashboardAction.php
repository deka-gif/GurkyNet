<?php

namespace App\Actions\Admin\Finance;

use App\Repositories\Contracts\FinanceRepositoryInterface;

class FinanceDashboardAction
{
    public function __construct(
        protected FinanceRepositoryInterface $financeRepository
    ) {}

    public function execute(): array
    {
        return $this->financeRepository->getDashboardMetrics();
    }
}
