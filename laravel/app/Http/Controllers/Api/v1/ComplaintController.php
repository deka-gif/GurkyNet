<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Http\Resources\SupportTicketResource;
use App\Models\SupportTicket;
use App\Models\TicketReply;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class ComplaintController extends Controller
{
    use ApiResponseTrait;

    /**
     * Map API status labels to DB values used by admin CS.
     */
    protected array $statusToDb = [
        'Open' => 'Terbuka',
        'Processing' => 'Pending',
        'Resolved' => 'Selesai',
        'Rejected' => 'Ditolak',
        'Closed' => 'Tertutup',
    ];

    protected array $statusToApi = [
        'Terbuka' => 'Open',
        'Pending' => 'Processing',
        'Selesai' => 'Resolved',
        'Ditolak' => 'Rejected',
        'Tertutup' => 'Closed',
    ];

    public function index(Request $request): JsonResponse
    {
        $tickets = SupportTicket::query()
            ->with(['replies.user'])
            ->where('user_id', $request->user()->id)
            ->latest()
            ->paginate(min(50, max(1, (int) $request->input('per_page', 15))));

        $items = collect($tickets->items())->map(fn (SupportTicket $t) => $this->toComplaintPayload($t));

        return $this->paginatedResponse(
            'Daftar komplain berhasil dimuat.',
            $items,
            [
                'current_page' => $tickets->currentPage(),
                'last_page' => $tickets->lastPage(),
                'per_page' => $tickets->perPage(),
                'total' => $tickets->total(),
            ]
        );
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'category' => 'required|string|max:100',
            'subject' => 'required|string|max:255',
            'description' => 'required|string|max:5000',
            'transaction_id' => 'nullable|integer|exists:transactions,id',
            'attachment' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:4096',
        ]);

        $user = $request->user();
        $attachmentPath = null;
        if ($request->hasFile('attachment')) {
            $attachmentPath = $request->file('attachment')->store('complaints/' . $user->id, 'public');
        }

        $ticket = DB::transaction(function () use ($user, $data, $attachmentPath) {
            $ticket = SupportTicket::create([
                'ticket_number' => 'TKT-' . now()->format('YmdHis') . '-' . mt_rand(100, 999),
                'user_id' => $user->id,
                'transaction_id' => $data['transaction_id'] ?? null,
                'category' => $data['category'],
                'subject' => $data['subject'],
                'description' => $data['description'],
                'attachment' => $attachmentPath,
                'priority' => 'Sedang',
                'status' => 'Terbuka',
            ]);

            TicketReply::create([
                'support_ticket_id' => $ticket->id,
                'user_id' => $user->id,
                'message' => $data['description'],
            ]);

            return $ticket->load(['replies.user']);
        });

        return $this->successResponse('Komplain berhasil dibuat.', $this->toComplaintPayload($ticket), 201);
    }

    public function show(Request $request, int|string $id): JsonResponse
    {
        $ticket = SupportTicket::query()
            ->with(['replies.user'])
            ->where('user_id', $request->user()->id)
            ->where(function ($q) use ($id) {
                $q->where('id', $id)->orWhere('ticket_number', $id);
            })
            ->firstOrFail();

        return $this->successResponse('Detail komplain berhasil dimuat.', $this->toComplaintPayload($ticket));
    }

    protected function toComplaintPayload(SupportTicket $ticket): array
    {
        $adminReply = $ticket->replies
            ->filter(fn (TicketReply $r) => (int) $r->user_id !== (int) $ticket->user_id)
            ->sortByDesc('id')
            ->first();

        return [
            'id' => $ticket->id,
            'ticketNumber' => $ticket->ticket_number,
            'ticket_number' => $ticket->ticket_number,
            'userId' => $ticket->user_id,
            'transactionId' => $ticket->transaction_id,
            'category' => $ticket->category,
            'subject' => $ticket->subject,
            'description' => $ticket->description,
            'attachment' => $ticket->attachment
                ? Storage::disk('public')->url($ticket->attachment)
                : null,
            'status' => $this->statusToApi[$ticket->status] ?? $ticket->status,
            'statusRaw' => $ticket->status,
            'adminReply' => $adminReply?->message,
            'admin_reply' => $adminReply?->message,
            'closedAt' => $ticket->closed_at?->toIso8601String(),
            'closed_at' => $ticket->closed_at?->toIso8601String(),
            'replies' => $ticket->replies->map(fn (TicketReply $r) => [
                'id' => $r->id,
                'message' => $r->message,
                'userId' => $r->user_id,
                'userName' => $r->user?->name,
                'isStaff' => (int) $r->user_id !== (int) $ticket->user_id,
                'createdAt' => $r->created_at?->toIso8601String(),
            ])->values()->all(),
            'createdAt' => $ticket->created_at?->toIso8601String(),
            'updatedAt' => $ticket->updated_at?->toIso8601String(),
        ];
    }
}
