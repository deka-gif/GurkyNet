<?php

namespace App\Repositories\Eloquent;

use App\Repositories\Contracts\CustomerSupportRepositoryInterface;
use App\Models\SupportTicket;
use App\Models\TicketReply;
use App\Models\User;
use App\Models\Transaction;
use App\Models\Wallet;
use App\Models\WalletHistory;
use App\Models\DigiflazzTransaction;
use App\Models\MidtransTransaction;
use App\Models\ActivityLog;
use App\Models\Faq;
use App\Models\Workflow;
use App\Enums\TransactionStatus;
use App\Enums\WalletHistoryType;
use App\Support\Support\TicketStatus;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\HttpException;

class CustomerSupportRepository implements CustomerSupportRepositoryInterface
{
    /**
     * Get customer support dashboard metrics.
     */
    public function getDashboardMetrics(): array
    {
        $openTickets = SupportTicket::whereIn('status', \App\Support\Support\TicketStatus::openWorkStatuses())->count();
        $pendingTickets = SupportTicket::whereIn('status', [
            \App\Support\Support\TicketStatus::ASSIGNED_CS,
            \App\Support\Support\TicketStatus::ESCALATED_OPS,
            \App\Support\Support\TicketStatus::ESCALATED_FINANCE,
            'Pending',
        ])->count();
        $resolvedToday = SupportTicket::whereIn('status', [
            \App\Support\Support\TicketStatus::RESOLVED,
            \App\Support\Support\TicketStatus::CLOSED,
            'Selesai',
            'Resolved',
            'Closed',
            'Tertutup',
        ])
            ->whereDate('updated_at', now()->toDateString())
            ->count();

        $recentTickets = SupportTicket::with('user:id,name,email')
            ->latest()
            ->take(5)
            ->get();

        $recentRefundRequests = Transaction::with('user:id,name,email')
            ->whereIn('status', ['failed', 'canceled'])
            ->latest()
            ->take(5)
            ->get();

        return [
            'open_tickets' => $openTickets,
            'pending_tickets' => $pendingTickets,
            'resolved_today' => $resolvedToday,
            'avg_response_time' => $this->calculateAverageFirstResponseTime(),
            'recent_tickets' => $recentTickets,
            'recent_refund_requests' => $recentRefundRequests,
        ];
    }

    /**
     * Average time between ticket creation and the first support reply,
     * formatted for display (e.g. "4m 12s"), or null when no replies exist.
     */
    protected function calculateAverageFirstResponseTime(): ?string
    {
        $firstReplies = TicketReply::selectRaw('support_ticket_id, MIN(created_at) as first_reply_at')
            ->groupBy('support_ticket_id')
            ->pluck('first_reply_at', 'support_ticket_id');

        if ($firstReplies->isEmpty()) {
            return null;
        }

        $ticketCreatedAt = SupportTicket::whereIn('id', $firstReplies->keys())
            ->pluck('created_at', 'id');

        $totalSeconds = 0;
        $count = 0;
        foreach ($firstReplies as $ticketId => $firstReplyAt) {
            $createdAt = $ticketCreatedAt[$ticketId] ?? null;
            if (!$createdAt) {
                continue;
            }
            $diff = \Illuminate\Support\Carbon::parse($firstReplyAt)->diffInSeconds($createdAt, true);
            $totalSeconds += $diff;
            $count++;
        }

        if ($count === 0) {
            return null;
        }

        $avg = (int) round($totalSeconds / $count);
        $hours = intdiv($avg, 3600);
        $minutes = intdiv($avg % 3600, 60);
        $seconds = $avg % 60;

        if ($hours > 0) {
            return "{$hours}j {$minutes}m";
        }

        return "{$minutes}m {$seconds}s";
    }

    /**
     * Get paginated support tickets with filters.
     */
    public function getTickets(array $filters): LengthAwarePaginator
    {
        $perPage = $filters['per_page'] ?? 15;
        $query = SupportTicket::with(['user:id,name,email', 'transaction']);

        if (!empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('ticket_number', 'like', "%{$search}%")
                  ->orWhere('category', 'like', "%{$search}%")
                  ->orWhereHas('user', function ($uq) use ($search) {
                      $uq->where('name', 'like', "%{$search}%")
                         ->orWhere('email', 'like', "%{$search}%");
                  });
            });
        }

        if (!empty($filters['status'])) {
            $canonical = \App\Support\Support\TicketStatus::normalize($filters['status']);
            // Include legacy Indonesian values that map to the same canonical status.
            $legacyAliases = match ($canonical) {
                \App\Support\Support\TicketStatus::OPEN => ['Terbuka', 'Open', 'open'],
                \App\Support\Support\TicketStatus::ASSIGNED_CS => ['Pending', 'pending', 'assigned_cs', 'Processing'],
                \App\Support\Support\TicketStatus::RESOLVED => ['Selesai', 'Resolved', 'resolved'],
                \App\Support\Support\TicketStatus::CLOSED => ['Tertutup', 'Closed', 'closed', 'Ditolak'],
                default => [$canonical],
            };
            $query->whereIn('status', array_values(array_unique(array_merge([$canonical], $legacyAliases))));
        }

        if (!empty($filters['priority'])) {
            $priority = $filters['priority'];
            $priorityMap = [
                'high' => 'Tinggi',
                'medium' => 'Sedang',
                'low' => 'Rendah',
                'tinggi' => 'Tinggi',
                'sedang' => 'Sedang',
                'rendah' => 'Rendah'
            ];
            $mappedPriority = $priorityMap[strtolower($priority)] ?? $priority;
            $query->where('priority', $mappedPriority);
        }

        if (!empty($filters['category'])) {
            $query->where('category', $filters['category']);
        }

        return $query->latest()->paginate($perPage);
    }

    /**
     * Get support ticket details.
     */
    public function getTicketById(string|int $id): SupportTicket
    {
        return SupportTicket::with(['user', 'transaction', 'replies.user'])
            ->where('id', $id)
            ->orWhere('ticket_number', $id)
            ->firstOrFail();
    }

    /**
     * Create a support ticket for an existing customer.
     */
    public function createTicket(array $data): SupportTicket
    {
        $email = $data['customerEmail'] ?? $data['customer_email'] ?? $data['email'] ?? null;
        $userId = $data['user_id'] ?? null;

        $user = $userId
            ? User::find($userId)
            : ($email ? User::where('email', $email)->first() : null);

        if (!$user) {
            throw new \InvalidArgumentException('Pelanggan tidak ditemukan. Gunakan email pelanggan terdaftar.');
        }

        $priorityMap = [
            'critical' => 'Tinggi',
            'high' => 'Tinggi',
            'medium' => 'Sedang',
            'low' => 'Rendah',
            'tinggi' => 'Tinggi',
            'sedang' => 'Sedang',
            'rendah' => 'Rendah',
        ];
        $priorityRaw = strtolower((string) ($data['priority'] ?? 'Sedang'));
        $priority = $priorityMap[$priorityRaw] ?? ($data['priority'] ?? 'Sedang');

        $status = \App\Support\Support\TicketStatus::normalize(
            (string) ($data['status'] ?? \App\Support\Support\TicketStatus::OPEN)
        );

        $ticket = SupportTicket::create([
            'ticket_number' => 'TKT-' . now()->format('YmdHis') . '-' . mt_rand(100, 999),
            'user_id' => $user->id,
            'transaction_id' => $data['transaction_id'] ?? null,
            'category' => $data['category'] ?? 'Umum',
            'subject' => $data['subject'] ?? null,
            'description' => $data['description'] ?? $data['message'] ?? null,
            'priority' => $priority,
            'status' => $status,
            'assigned_to' => $data['assigned_to'] ?? Auth::id(),
            'source' => $data['source'] ?? 'cs_manual',
        ]);

        if (! empty($ticket->assigned_to) && $status === \App\Support\Support\TicketStatus::OPEN) {
            $ticket->update(['status' => \App\Support\Support\TicketStatus::ASSIGNED_CS]);
        }

        $opening = trim((string) ($data['subject'] ?? $data['message'] ?? $data['description'] ?? ''));
        if ($opening !== '') {
            TicketReply::create([
                'support_ticket_id' => $ticket->id,
                'user_id' => Auth::id() ?: $user->id,
                'message' => $opening,
            ]);
        }

        ActivityLog::create([
            'user_id' => Auth::id(),
            'activity' => 'CUSTOMER_SUPPORT_CREATE_TICKET',
            'payload' => [
                'ticket_id' => $ticket->id,
                'ticket_number' => $ticket->ticket_number,
                'customer_id' => $user->id,
            ],
        ]);

        return $ticket->fresh(['user', 'transaction', 'replies.user']);
    }

    /**
     * Create reply for a ticket.
     */
    public function createReply(string|int $id, array $data): TicketReply
    {
        $ticket = SupportTicket::where('id', $id)->orWhere('ticket_number', $id)->firstOrFail();

        $reply = TicketReply::create([
            'support_ticket_id' => $ticket->id,
            'user_id' => \Illuminate\Support\Facades\Auth::id(),
            'message' => $data['message'],
        ]);

        // FR-CS-02 — first CS reply moves Baru → Diproses (assigned_cs).
        $canonical = \App\Support\Support\TicketStatus::normalize($ticket->status);
        if ($canonical === \App\Support\Support\TicketStatus::OPEN) {
            $ticket->update([
                'status' => \App\Support\Support\TicketStatus::ASSIGNED_CS,
                'assigned_to' => $ticket->assigned_to ?: Auth::id(),
            ]);
        }

        ActivityLog::create([
            'user_id' => \Illuminate\Support\Facades\Auth::id(),
            'activity' => 'CUSTOMER_SUPPORT_REPLY_TICKET',
            'payload' => [
                'ticket_id' => $ticket->id,
                'ticket_number' => $ticket->ticket_number,
                'reply_id' => $reply->id,
            ],
        ]);

        return $reply;
    }

    /**
     * Update ticket status (FR-CS-02 — SRS 7.8 vocabulary).
     *
     * @param  array<string, mixed>  $extra
     */
    public function updateTicketStatus(string|int $id, string $status, array $extra = []): SupportTicket
    {
        $ticket = SupportTicket::where('id', $id)->orWhere('ticket_number', $id)->firstOrFail();

        $mappedStatus = \App\Support\Support\TicketStatus::normalize($status);
        $updates = ['status' => $mappedStatus];

        if (array_key_exists('assigned_to', $extra) && $extra['assigned_to']) {
            $updates['assigned_to'] = (int) $extra['assigned_to'];
        } elseif ($mappedStatus === \App\Support\Support\TicketStatus::ASSIGNED_CS && ! $ticket->assigned_to) {
            $updates['assigned_to'] = Auth::id();
        }

        if ($mappedStatus === \App\Support\Support\TicketStatus::RESOLVED) {
            $updates['resolved_at'] = now();
        }
        if ($mappedStatus === \App\Support\Support\TicketStatus::CLOSED) {
            $updates['closed_at'] = now();
            $updates['resolved_at'] = $ticket->resolved_at ?: now();
        }

        $ticket->update($updates);

        ActivityLog::create([
            'user_id' => \Illuminate\Support\Facades\Auth::id(),
            'activity' => 'CUSTOMER_SUPPORT_UPDATE_TICKET_STATUS',
            'payload' => [
                'ticket_id' => $ticket->id,
                'ticket_number' => $ticket->ticket_number,
                'status' => $mappedStatus,
            ],
        ]);

        return $ticket->fresh(['user', 'transaction', 'replies.user', 'assignee']);
    }

    /**
     * Get paginated customers with search.
     */
    public function getCustomers(array $filters): LengthAwarePaginator
    {
        $perPage = $filters['per_page'] ?? 15;
        $query = User::with(['wallet'])
            ->withCount(['transactions', 'supportTickets'])
            ->where('role', \App\Enums\UserRole::USER);

        if (!empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%")
                  ->orWhere('phone_number', 'like', "%{$search}%");
            });
        }

        return $query->latest()->paginate($perPage);
    }

    /**
     * Get customer details.
     */
    public function getCustomerById(string|int $id): User
    {
        return User::with(['wallet', 'supportTickets' => fn ($query) => $query->latest()->take(5)])
            ->withCount(['transactions', 'supportTickets'])
            ->where('role', \App\Enums\UserRole::USER)
            ->where(function ($query) use ($id) {
                $query->where('id', $id)
                    ->orWhere('email', $id)
                    ->orWhere('phone_number', $id);
            })
            ->firstOrFail();
    }

    /**
     * Get customer transaction history.
     */
    public function getCustomerTransactions(string|int $id, array $filters): LengthAwarePaginator
    {
        $customer = $this->getCustomerById($id);
        $perPage = $filters['per_page'] ?? 15;

        $query = Transaction::with(['items', 'paymentHistory'])
            ->where('user_id', $customer->id);

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('invoice_number', 'like', "%{$search}%")
                    ->orWhere('service_name', 'like', "%{$search}%")
                    ->orWhere('target_number', 'like', "%{$search}%");
            });
        }

        return $query->latest()->paginate($perPage);
    }

    /**
     * Investigate a transaction.
     */
    public function getInvestigation(string $invoiceNumber): array
    {
        $transaction = Transaction::with(['user.wallet', 'items', 'paymentHistory'])
            ->where('invoice_number', $invoiceNumber)
            ->orWhere('id', $invoiceNumber)
            ->firstOrFail();

        $walletHistory = [];
        if ($transaction->user && $transaction->user->wallet) {
            $walletHistory = WalletHistory::where('wallet_id', $transaction->user->wallet->id)
                ->latest()
                ->get();
        }

        $digiflazzLogs = DigiflazzTransaction::where('transaction_id', $transaction->id)->latest()->get();
        $midtransLogs = MidtransTransaction::where('transaction_id', $transaction->id)->latest()->get();

        $activityLogs = ActivityLog::where('user_id', $transaction->user_id)
            ->latest()
            ->get();

        return [
            'transaction' => $transaction,
            'wallet_mutation' => $walletHistory,
            'digiflazz_logs' => $digiflazzLogs,
            'midtrans_logs' => $midtransLogs,
            'activity_logs' => $activityLogs,
        ];
    }

    /**
     * Get refund queue (failed or canceled transactions).
     */
    public function getRefundQueue(array $filters): LengthAwarePaginator
    {
        $perPage = $filters['per_page'] ?? 15;
        $query = Transaction::with('user:id,name,email')
            ->whereIn('status', ['failed', 'canceled']);

        if (!empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('invoice_number', 'like', "%{$search}%")
                  ->orWhereHas('user', function ($uq) use ($search) {
                      $uq->where('name', 'like', "%{$search}%")
                         ->orWhere('email', 'like', "%{$search}%");
                  });
            });
        }

        return $query->latest()->paginate($perPage);
    }

    /**
     * Get refund detail by transaction ID or invoice number.
     */
    public function getRefundById(string|int $id): Transaction
    {
        return Transaction::with(['user.wallet', 'items', 'paymentHistory', 'digiflazzTransaction', 'midtransTransaction'])
            ->where('id', $id)
            ->orWhere('invoice_number', $id)
            ->firstOrFail();
    }

    /**
     * Create a refund claim from customer support.
     */
    public function createRefund(array $data): Transaction
    {
        $transactionId = $data['transaction_id'] ?? $data['invoice_number'] ?? $data['transactionId'] ?? null;
        if (!$transactionId) {
            throw new \InvalidArgumentException('transaction_id atau invoice_number wajib diisi.', 422);
        }

        $transaction = $this->getRefundById($transactionId);
        $reason = $data['reason'] ?? $data['note'] ?? $data['notes'] ?? 'Diajukan oleh Customer Support';
        $transaction->notes = trim(($transaction->notes ? $transaction->notes . ' | ' : '') . 'Refund Diajukan CS: ' . $reason);
        $transaction->save();

        ActivityLog::create([
            'user_id' => Auth::id(),
            'activity' => 'CUSTOMER_SUPPORT_CREATE_REFUND',
            'payload' => [
                'transaction_id' => $transaction->id,
                'invoice_number' => $transaction->invoice_number,
                'reason' => $reason,
            ],
        ]);

        return $transaction->fresh(['user.wallet', 'items', 'paymentHistory']);
    }

    /**
     * Update refund notes / non-mutating status labels only.
     * FR-CS / SRS 4.4.5 — CS MUST NOT approve balance-mutating refunds.
     */
    public function updateRefund(string|int $id, array $data): Transaction
    {
        $status = strtolower((string) ($data['status'] ?? ''));
        $note = $data['note'] ?? $data['notes'] ?? $data['reason'] ?? null;

        // Compliance: block CS wallet mutation (approve / reject-that-credits). Escalate to Finance instead.
        if (in_array($status, ['approved', 'approve', 'disetujui', 'rejected', 'reject', 'ditolak'], true)) {
            throw new \InvalidArgumentException(
                'CS tidak berwenang menyetujui/menolak refund yang mengubah saldo. Eskalasikan ke Finance.',
                403
            );
        }

        $transaction = $this->getRefundById($id);
        $label = $status ? 'Refund Status CS: ' . $status : 'Refund Diperbarui CS';
        $transaction->notes = trim(($transaction->notes ? $transaction->notes . ' | ' : '') . $label . ($note ? ': ' . $note : ''));
        $transaction->save();

        ActivityLog::create([
            'user_id' => Auth::id(),
            'activity' => 'CUSTOMER_SUPPORT_UPDATE_REFUND',
            'payload' => [
                'transaction_id' => $transaction->id,
                'invoice_number' => $transaction->invoice_number,
                'status' => $status ?: null,
                'note' => $note,
            ],
        ]);

        return $transaction->fresh(['user.wallet', 'items', 'paymentHistory']);
    }

    /**
     * Escalate a refund claim to Finance via Workflow SSOT (FR-CS-07).
     * Must link SupportTicket so lifecycle becomes escalated_finance (SRS 7.8).
     */
    public function escalateRefund(string|int $id, array $data): Transaction
    {
        $transaction = $this->getRefundById($id);
        $note = $data['note'] ?? $data['notes'] ?? $data['reason'] ?? 'Perlu review lanjutan Finance';
        $transaction->notes = trim(($transaction->notes ? $transaction->notes . ' | ' : '') . 'Refund Dieskalasi CS: ' . $note);
        $transaction->save();

        $actor = Auth::user();
        if ($actor) {
            $ticket = $this->resolveTicketForRefundEscalation($transaction, (string) $note);

            $existing = Workflow::query()
                ->where('transaction_id', $transaction->id)
                ->where('support_ticket_id', $ticket->id)
                ->where('current_division', 'finance')
                ->whereNotIn('status', ['resolved', 'rejected', 'cancelled', 'closed'])
                ->first();

            if ($existing) {
                // Idempotent re-escalate: keep single open finance workflow + ticket status.
                $ticket->update(['status' => TicketStatus::ESCALATED_FINANCE]);
            } else {
                app(\App\Services\Workflow\WorkflowEngineService::class)->createFromCs($actor, [
                    'target_division' => 'finance',
                    'type' => 'refund_request',
                    'category' => 'refund_request',
                    'title' => 'Refund eskalasi: '.$transaction->invoice_number,
                    'description' => $note,
                    'transaction_id' => $transaction->id,
                    'support_ticket_id' => $ticket->id,
                    'priority' => 'high',
                ]);
            }
        }

        ActivityLog::create([
            'user_id' => Auth::id(),
            'activity' => 'CUSTOMER_SUPPORT_ESCALATE_REFUND',
            'payload' => [
                'transaction_id' => $transaction->id,
                'invoice_number' => $transaction->invoice_number,
                'note' => $note,
            ],
        ]);

        return $transaction->fresh(['user.wallet', 'items', 'paymentHistory']);
    }

    /**
     * FR-CS-07 — reuse ticket for transaction or create one; never leave escalate without ticket link.
     */
    protected function resolveTicketForRefundEscalation(Transaction $transaction, string $note): SupportTicket
    {
        $openStatuses = TicketStatus::openWorkStatuses();

        $ticket = SupportTicket::query()
            ->where('transaction_id', $transaction->id)
            ->whereIn('status', $openStatuses)
            ->orderByDesc('id')
            ->first();

        if (! $ticket) {
            $ticket = SupportTicket::query()
                ->where('transaction_id', $transaction->id)
                ->orderByDesc('id')
                ->first();
        }

        if ($ticket) {
            return $ticket;
        }

        return SupportTicket::create([
            'ticket_number' => 'TKT-'.now()->format('YmdHis').'-'.mt_rand(100, 999),
            'user_id' => $transaction->user_id,
            'transaction_id' => $transaction->id,
            'category' => 'Refund',
            'subject' => 'Refund eskalasi: '.$transaction->invoice_number,
            'description' => $note,
            'priority' => 'Tinggi',
            'status' => TicketStatus::ASSIGNED_CS,
            'assigned_to' => Auth::id(),
            'source' => 'cs_refund_escalate',
        ]);
    }

    /**
     * SRS 4.4.5 — CS must NEVER mutate wallet via refund approve.
     * Dead-path hard block: method must not reach WalletRefundService.
     */
    protected function approveRefund(string|int $id, ?string $note = null): Transaction
    {
        throw new HttpException(
            403,
            'CS tidak berwenang menyetujui refund yang mengubah saldo. Eskalasikan ke Finance (FR-CS-07 / SRS 4.4.5).'
        );
    }

    /**
     * SRS 4.4.5 — CS must NEVER reject-via-mutator that historically touched refund state for wallet flows.
     */
    protected function rejectRefund(string|int $id, ?string $note = null): Transaction
    {
        throw new HttpException(
            403,
            'CS tidak berwenang menolak refund melalui mutator saldo. Eskalasikan ke Finance (FR-CS-07 / SRS 4.4.5).'
        );
    }

    /**
     * Get knowledge base (FAQ & SOP articles).
     */
    public function getKnowledgeBase(): array
    {
        // SOP articles are managed as published static pages (CMS); no dedicated
        // SOP table exists, so only real DB-backed content is returned here.
        $sops = \App\Models\StaticPage::where('status', 'published')
            ->where(function ($query) {
                $query->where('slug', 'like', 'sop-%')
                    ->orWhere('title', 'like', 'SOP%');
            })
            ->orderBy('title')
            ->get(['id', 'title', 'content', 'slug'])
            ->map(fn ($page) => [
                'id' => $page->id,
                'title' => $page->title,
                'content' => $page->content,
                'category' => 'SOP',
            ])
            ->values()
            ->all();

        return [
            'faqs' => Faq::orderBy('order')->get(),
            'sops' => $sops,
        ];
    }

    /**
     * Resolve a single FAQ or SOP article from the knowledge base.
     */
    public function getKnowledgeBaseArticle(string|int $id): ?array
    {
        $faq = Faq::find($id);
        if ($faq) {
            return [
                'id' => $faq->id,
                'title' => $faq->question ?? $faq->title ?? 'FAQ',
                'content' => $faq->answer ?? $faq->content ?? '',
                'category' => 'FAQ',
            ];
        }

        $page = \App\Models\StaticPage::find($id);
        if ($page) {
            return [
                'id' => $page->id,
                'title' => $page->title,
                'content' => $page->content,
                'category' => 'SOP',
            ];
        }

        return null;
    }
}
