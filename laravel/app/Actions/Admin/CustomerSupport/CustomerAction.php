<?php

namespace App\Actions\Admin\CustomerSupport;

use App\Repositories\Contracts\CustomerSupportRepositoryInterface;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class CustomerAction
{
    public function __construct(
        protected CustomerSupportRepositoryInterface $customerSupportRepository
    ) {}

    public function list(array $filters): LengthAwarePaginator
    {
        return $this->customerSupportRepository->getCustomers($filters);
    }

    public function show(string|int $id): User
    {
        return $this->customerSupportRepository->getCustomerById($id);
    }

    public function transactions(string|int $id, array $filters): LengthAwarePaginator
    {
        return $this->customerSupportRepository->getCustomerTransactions($id, $filters);
    }
}
