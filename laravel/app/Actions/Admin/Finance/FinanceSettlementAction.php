<?php

namespace App\Actions\Admin\Finance;

use App\Repositories\Contracts\FinanceRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class FinanceSettlementAction
{
    public function __construct(
        protected FinanceRepositoryInterface $financeRepository
    ) {}

    public function execute(array $filters): LengthAwarePaginator
    {
        return $this->financeRepository->getSettlements($filters);
    }
}
