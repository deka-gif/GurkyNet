<?php

namespace App\Repositories\Contracts;

use App\Models\SupportTicket;
use App\Models\TicketReply;
use App\Models\User;
use App\Models\Transaction;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

interface CustomerSupportRepositoryInterface
{
    /**
     * Get customer support dashboard metrics.
     */
    public function getDashboardMetrics(): array;

    /**
     * Get paginated support tickets with filters.
     */
    public function getTickets(array $filters): LengthAwarePaginator;

    /**
     * Get support ticket details.
     */
    public function getTicketById(string|int $id): SupportTicket;

    /**
     * Create a support ticket (optionally with an opening message).
     */
    public function createTicket(array $data): SupportTicket;

    /**
     * Create reply for a ticket.
     */
    public function createReply(string|int $id, array $data): TicketReply;

    /**
     * Get a single knowledge-base article (FAQ or SOP) by id.
     */
    public function getKnowledgeBaseArticle(string|int $id): ?array;

    /**
     * Update ticket status.
     */
    public function updateTicketStatus(string|int $id, string $status): SupportTicket;

    /**
     * Get paginated customers with search.
     */
    public function getCustomers(array $filters): LengthAwarePaginator;

    /**
     * Get customer details.
     */
    public function getCustomerById(string|int $id): User;

    /**
     * Get customer transaction history.
     */
    public function getCustomerTransactions(string|int $id, array $filters): LengthAwarePaginator;

    /**
     * Investigate a transaction.
     */
    public function getInvestigation(string $invoiceNumber): array;

    /**
     * Get refund queue (failed or canceled transactions).
     */
    public function getRefundQueue(array $filters): LengthAwarePaginator;

    /**
     * Get refund detail by transaction ID or invoice number.
     */
    public function getRefundById(string|int $id): Transaction;

    /**
     * Create a refund claim from customer support.
     */
    public function createRefund(array $data): Transaction;

    /**
     * Update refund status or notes.
     */
    public function updateRefund(string|int $id, array $data): Transaction;

    /**
     * Escalate a refund claim.
     */
    public function escalateRefund(string|int $id, array $data): Transaction;

    /**
     * Get knowledge base (FAQ & SOP articles).
     */
    public function getKnowledgeBase(): array;
}
