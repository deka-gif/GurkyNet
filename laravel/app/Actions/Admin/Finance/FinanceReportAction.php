<?php

namespace App\Actions\Admin\Finance;

use App\Repositories\Contracts\FinanceRepositoryInterface;

class FinanceReportAction
{
    public function __construct(
        protected FinanceRepositoryInterface $financeRepository
    ) {}

    public function execute(array $filters): array
    {
        return $this->financeRepository->getFinancialReports($filters);
    }
}
