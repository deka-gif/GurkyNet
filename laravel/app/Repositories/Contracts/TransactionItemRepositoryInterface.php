<?php

namespace App\Repositories\Contracts;

use App\Models\TransactionItem;

interface TransactionItemRepositoryInterface
{
    public function create(array $data): TransactionItem;
}
