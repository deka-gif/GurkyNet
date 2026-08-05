<?php

namespace App\Actions\Admin\CustomerSupport;

use App\Repositories\Contracts\CustomerSupportRepositoryInterface;
use App\Models\Transaction;
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

    public function show(string|int $id): Transaction
    {
        return $this->customerSupportRepository->getRefundById($id);
    }

    public function create(array $data): Transaction
    {
        return $this->customerSupportRepository->createRefund($data);
    }

    public function update(string|int $id, array $data): Transaction
    {
        return $this->customerSupportRepository->updateRefund($id, $data);
    }

    public function escalate(string|int $id, array $data): Transaction
    {
        return $this->customerSupportRepository->escalateRefund($id, $data);
    }
}
