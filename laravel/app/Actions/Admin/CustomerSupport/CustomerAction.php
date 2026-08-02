<?php

namespace App\Actions\Admin\CustomerSupport;

use App\Repositories\Contracts\CustomerSupportRepositoryInterface;
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
}
