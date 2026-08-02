<?php

namespace App\Repositories\Contracts;

use App\Models\SupportTicket;
use App\Models\TicketReply;
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
     * Create reply for a ticket.
     */
    public function createReply(string|int $id, array $data): TicketReply;

    /**
     * Update ticket status.
     */
    public function updateTicketStatus(string|int $id, string $status): SupportTicket;

    /**
     * Get paginated customers with search.
     */
    public function getCustomers(array $filters): LengthAwarePaginator;

    /**
     * Investigate a transaction.
     */
    public function getInvestigation(string $invoiceNumber): array;

    /**
     * Get refund queue (failed or canceled transactions).
     */
    public function getRefundQueue(array $filters): LengthAwarePaginator;

    /**
     * Get knowledge base (FAQ & SOP articles).
     */
    public function getKnowledgeBase(): array;
}
