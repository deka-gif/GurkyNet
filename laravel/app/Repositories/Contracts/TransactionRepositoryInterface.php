<?php

namespace App\Repositories\Contracts;

use App\Models\Transaction;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;

interface TransactionRepositoryInterface
{
    public function getPaginatedForUser(int $userId, array $filters = []): LengthAwarePaginator;
    public function findById(int $id): ?Transaction;
    public function findByInvoiceNumber(string $invoiceNumber): ?Transaction;
    public function create(array $data): Transaction;
    public function updateStatus(int $id, string $status, ?string $notes = null): bool;
}
