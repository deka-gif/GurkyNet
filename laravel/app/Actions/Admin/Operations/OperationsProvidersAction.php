<?php

namespace App\Actions\Admin\Operations;

use App\Repositories\Contracts\OperationsRepositoryInterface;
use App\Models\Provider;
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

    public function update(string|int $id, array $data): Provider
    {
        return $this->operationsRepository->updateProvider($id, $data);
    }
}
