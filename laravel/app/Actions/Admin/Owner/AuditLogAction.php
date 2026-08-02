<?php

namespace App\Actions\Admin\Owner;

use App\Repositories\Contracts\OwnerRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class AuditLogAction
{
    public function __construct(
        protected OwnerRepositoryInterface $ownerRepository
    ) {}

    public function execute(array $filters): LengthAwarePaginator
    {
        return $this->ownerRepository->getAuditLogs($filters);
    }
}
