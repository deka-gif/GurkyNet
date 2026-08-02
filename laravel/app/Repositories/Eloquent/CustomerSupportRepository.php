<?php

namespace App\Repositories\Eloquent;

use App\Repositories\Contracts\CustomerSupportRepositoryInterface;
use App\Models\SupportTicket;
use App\Models\TicketReply;
use App\Models\User;
use App\Models\Transaction;
use App\Models\WalletHistory;
use App\Models\DigiflazzTransaction;
use App\Models\MidtransTransaction;
use App\Models\ActivityLog;
use App\Models\Faq;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class CustomerSupportRepository implements CustomerSupportRepositoryInterface
{
    /**
     * Get customer support dashboard metrics.
     */
    public function getDashboardMetrics(): array
    {
        $openTickets = SupportTicket::whereIn('status', ['Terbuka', 'Open'])->count();
        $pendingTickets = SupportTicket::where('status', 'Pending')->count();
        $resolvedToday = SupportTicket::whereIn('status', ['Selesai', 'Resolved', 'Closed', 'Tertutup'])
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
            'avg_response_time' => '4m 12s',
            'recent_tickets' => $recentTickets,
            'recent_refund_requests' => $recentRefundRequests,
        ];
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
            $status = $filters['status'];
            $statusMap = [
                'open' => 'Terbuka',
                'pending' => 'Pending',
                'resolved' => 'Selesai',
                'closed' => 'Tertutup',
                'terbuka' => 'Terbuka',
                'selesai' => 'Selesai',
                'tertutup' => 'Tertutup'
            ];
            $mappedStatus = $statusMap[strtolower($status)] ?? $status;
            $query->where('status', $mappedStatus);
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

        // Automatically update the status to "Pending" or active when support replies, or keep current
        // Let's log the activity
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
     * Update ticket status.
     */
    public function updateTicketStatus(string|int $id, string $status): SupportTicket
    {
        $ticket = SupportTicket::where('id', $id)->orWhere('ticket_number', $id)->firstOrFail();

        $statusMap = [
            'open' => 'Terbuka',
            'pending' => 'Pending',
            'resolved' => 'Selesai',
            'closed' => 'Tertutup',
            'terbuka' => 'Terbuka',
            'selesai' => 'Selesai',
            'tertutup' => 'Tertutup'
        ];

        $mappedStatus = $statusMap[strtolower($status)] ?? $status;
        $ticket->update(['status' => $mappedStatus]);

        ActivityLog::create([
            'user_id' => \Illuminate\Support\Facades\Auth::id(),
            'activity' => 'CUSTOMER_SUPPORT_UPDATE_TICKET_STATUS',
            'payload' => [
                'ticket_id' => $ticket->id,
                'ticket_number' => $ticket->ticket_number,
                'status' => $mappedStatus,
            ],
        ]);

        return $ticket;
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
     * Investigate a transaction.
     */
    public function getInvestigation(string $invoiceNumber): array
    {
        $transaction = Transaction::with(['user.wallet', 'items'])->where('invoice_number', $invoiceNumber)->firstOrFail();

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
     * Get knowledge base (FAQ & SOP articles).
     */
    public function getKnowledgeBase(): array
    {
        return [
            'faqs' => Faq::orderBy('order')->get(),
            'sops' => [
                [
                    'id' => 1,
                    'title' => 'SOP Mengatasi Transaksi Token PLN Delay',
                    'content' => '1. Cek status di Digiflazz Logs. 2. Jika sukses tapi SN belum keluar, tunggu maksimal 5 menit. 3. Jika gagal, lakukan refund saldo otomatis.',
                    'category' => 'PPOB & PLN',
                ],
                [
                    'id' => 2,
                    'title' => 'SOP Prosedur Refund Manual',
                    'content' => '1. Verifikasi keluhan pelanggan. 2. Cek mutasi dompet pelanggan. 3. Lakukan pengembalian dana melalui menu refund di dashboard finansial.',
                    'category' => 'Finance & Wallet',
                ]
            ]
        ];
    }
}
