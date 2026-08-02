<?php

namespace App\Repositories\Eloquent;

use App\Models\TransactionItem;
use App\Repositories\Contracts\TransactionItemRepositoryInterface;

class TransactionItemRepository implements TransactionItemRepositoryInterface
{
    public function create(array $data): TransactionItem
    {
        return TransactionItem::create($data);
    }
}
