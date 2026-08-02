<?php

namespace App\Actions\Admin\Operations;

use App\Repositories\Contracts\OperationsRepositoryInterface;

class OperationsDashboardAction
{
    public function __construct(
        protected OperationsRepositoryInterface $operationsRepository
    ) {}

    public function execute(): array
    {
        return $this->operationsRepository->getDashboardMetrics();
    }
}
