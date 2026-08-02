<?php

namespace App\Actions\Admin\CustomerSupport;

use App\Repositories\Contracts\CustomerSupportRepositoryInterface;

class InvestigationAction
{
    public function __construct(
        protected CustomerSupportRepositoryInterface $customerSupportRepository
    ) {}

    public function execute(string $invoiceNumber): array
    {
        return $this->customerSupportRepository->getInvestigation($invoiceNumber);
    }
}
