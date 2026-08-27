<?php

namespace App\Actions\Admin\CustomerSupport;

use App\Repositories\Contracts\CustomerSupportRepositoryInterface;
use App\Models\SupportTicket;
use App\Models\TicketReply;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class TicketAction
{
    public function __construct(
        protected CustomerSupportRepositoryInterface $customerSupportRepository
    ) {}

    public function list(array $filters): LengthAwarePaginator
    {
        return $this->customerSupportRepository->getTickets($filters);
    }

    public function show(string|int $id): SupportTicket
    {
        return $this->customerSupportRepository->getTicketById($id);
    }

    public function reply(string|int $id, array $data): TicketReply
    {
        return $this->customerSupportRepository->createReply($id, $data);
    }

    public function create(array $data): SupportTicket
    {
        return $this->customerSupportRepository->createTicket($data);
    }

    public function updateStatus(string|int $id, string $status, array $extra = []): SupportTicket
    {
        return $this->customerSupportRepository->updateTicketStatus($id, $status, $extra);
    }
}
