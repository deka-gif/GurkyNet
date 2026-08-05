<?php

namespace App\Actions\Admin\CustomerSupport;

use App\Repositories\Contracts\CustomerSupportRepositoryInterface;

class InvestigationAction
{
    public function __construct(
        protected CustomerSupportRepositoryInterface $customerSupportRepository
    ) {}

    public function execute(?string $invoiceNumber): array
    {
        if (!$invoiceNumber) {
            throw new \InvalidArgumentException('Nomor invoice atau ID transaksi wajib diisi.', 422);
        }

        return $this->customerSupportRepository->getInvestigation($invoiceNumber);
    }
}
