<?php

namespace App\Actions\Admin\Operations;

use App\Repositories\Contracts\OperationsRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class OperationsProvidersAction
{
    public function __construct(
        protected OperationsRepositoryInterface $operationsRepository
    ) {}

    public function list(array $filters): LengthAwarePaginator
    {
        return $this->operationsRepository->getProviders($filters);
    }

    /**
     * @return array<string, mixed>
     */
    public function update(string|int $id, array $data): array
    {
        return $this->operationsRepository->updateProvider($id, $data);
    }

    /**
     * @return array<int, mixed>
     */
    public function refreshStatuses(): array
    {
        return $this->operationsRepository->refreshProviderStatuses();
    }
}