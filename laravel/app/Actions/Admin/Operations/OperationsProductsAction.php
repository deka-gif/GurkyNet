<?php

namespace App\Actions\Admin\Operations;

use App\Repositories\Contracts\OperationsRepositoryInterface;
use App\Models\Product;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class OperationsProductsAction
{
    public function __construct(
        protected OperationsRepositoryInterface $operationsRepository
    ) {}

    public function list(array $filters): LengthAwarePaginator
    {
        return $this->operationsRepository->getProducts($filters);
    }

    public function update(string|int $id, array $data): Product
    {
        return $this->operationsRepository->updateProduct($id, $data);
    }
}
