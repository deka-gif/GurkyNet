<?php

namespace App\Actions\Admin\Operations;

use App\Repositories\Contracts\OperationsRepositoryInterface;

class OperationsPricingAction
{
    public function __construct(
        protected OperationsRepositoryInterface $operationsRepository
    ) {}

    public function get(array $filters = []): array
    {
        return $this->operationsRepository->getPricing($filters);
    }

    public function update(array $data): array
    {
        return $this->operationsRepository->updatePricing($data);
    }
}
