<?php

namespace App\Repositories\Eloquent;

use App\Models\Transaction;
use App\Repositories\Contracts\TransactionRepositoryInterface;
use Illuminate\Pagination\LengthAwarePaginator;

class TransactionRepository implements TransactionRepositoryInterface
{
    public function getPaginatedForUser(int $userId, array $filters = []): LengthAwarePaginator
    {
        $query = Transaction::query()
            ->with(['items'])
            ->where('user_id', $userId);

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['start_date'])) {
            $query->whereDate('created_at', '>=', $filters['start_date']);
        }

        if (!empty($filters['end_date'])) {
            $query->whereDate('created_at', '<=', $filters['end_date']);
        }

        $perPage = $filters['per_page'] ?? 15;

        return $query->latest()->paginate($perPage);
    }

    public function findById(int $id): ?Transaction
    {
        return Transaction::with(['items', 'user'])->find($id);
    }

    public function findByInvoiceNumber(string $invoiceNumber): ?Transaction
    {
        return Transaction::with(['items', 'user'])->where('invoice_number', $invoiceNumber)->first();
    }

    public function create(array $data): Transaction
    {
        return Transaction::create($data);
    }

    public function updateStatus(int $id, string $status, ?string $notes = null): bool
    {
        $transaction = Transaction::find($id);
        if (!$transaction) {
            return false;
        }

        $updateData = ['status' => $status];
        if ($notes !== null) {
            $updateData['notes'] = $notes;
        }

        return $transaction->update($updateData);
    }
}
