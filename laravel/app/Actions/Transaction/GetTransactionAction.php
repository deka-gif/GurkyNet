<?php

namespace App\Actions\Transaction;

use App\Models\Transaction;
use App\Repositories\Contracts\TransactionRepositoryInterface;

class GetTransactionAction
{
    protected TransactionRepositoryInterface $transactionRepository;

    public function __construct(TransactionRepositoryInterface $transactionRepository)
    {
        $this->transactionRepository = $transactionRepository;
    }

    public function execute(int $id): ?Transaction
    {
        return $this->transactionRepository->findById($id);
    }

    public function executeByInvoice(string $invoiceNumber): ?Transaction
    {
        return $this->transactionRepository->findByInvoiceNumber($invoiceNumber);
    }
}
