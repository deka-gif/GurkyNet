<?php

namespace App\Actions\Admin\CustomerSupport;

use App\Repositories\Contracts\CustomerSupportRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class RefundQueueAction
{
    public function __construct(
        protected CustomerSupportRepositoryInterface $customerSupportRepository
    ) {}

    public function execute(array $filters): LengthAwarePaginator
    {
        return $this->customerSupportRepository->getRefundQueue($filters);
    }
}
