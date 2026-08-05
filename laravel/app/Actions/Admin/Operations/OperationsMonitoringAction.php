<?php

namespace App\Actions\Admin\Operations;

use App\Repositories\Contracts\OperationsRepositoryInterface;

class OperationsMonitoringAction
{
    public function __construct(
        protected OperationsRepositoryInterface $operationsRepository
    ) {}

    public function execute(array $filters = []): array
    {
        return $this->operationsRepository->getMonitoring($filters);
    }
}