<?php

namespace App\Actions\Admin\CustomerSupport;

use App\Repositories\Contracts\CustomerSupportRepositoryInterface;

class KnowledgeBaseAction
{
    public function __construct(
        protected CustomerSupportRepositoryInterface $customerSupportRepository
    ) {}

    public function execute(): array
    {
        return $this->customerSupportRepository->getKnowledgeBase();
    }

    public function show(string|int $id): ?array
    {
        return $this->customerSupportRepository->getKnowledgeBaseArticle($id);
    }
}
