<?php

namespace App\Services\Support;

use App\Contracts\Realtime\RealtimeTransport;
use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\ChatMessage;
use App\Models\Conversation;
use App\Models\DivisionNotification;
use App\Models\SupportTicket;
use App\Models\TicketReply;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ChatService
{
    public function __construct(
        protected RealtimeTransport $realtime
    ) {}

    public function getOrCreateForUser(User $user, ?int $transactionId = null, ?string $subject = null): Conversation
    {
        $open = Conversation::query()
            ->where('user_id', $user->id)
            ->whereIn('status', ['open', 'waiting', 'assigned'])
            ->latest('id')
            ->first();

        if ($open) {
            if ($transactionId && ! $open->transaction_id) {
                $open->update(['transaction_id' => $transactionId]);
            }

            return $open->fresh(['user', 'assignedAgent']);
        }

        $conv = Conversation::create([
            'user_id' => $user->id,
            'status' => 'open',
            'subject' => $subject ?: 'Live Chat',
            'transaction_id' => $transactionId,
            'last_message_at' => now(),
            'last_message_preview' => 'Percakapan dimulai',
        ]);

        $this->systemMessage($conv, 'Percakapan Live Chat dimulai. Tim Customer Support akan segera membantu.');

        $this->log('CHAT_CONVERSATION_CREATED', [
            'conversation_id' => $conv->id,
            'user_id' => $user->id,
        ]);

        $this->realtime->publish('chat.agents', 'ConversationUpdated', $this->conversationPayload($conv));
        $this->realtime->publish('chat.user.'.$user->id, 'ConversationUpdated', $this->conversationPayload($conv));

        return $conv->fresh(['user', 'assignedAgent']);
    }

    /**
     * @return array{conversation:array,messages:list<array>}
     */
    public function thread(Conversation $conversation, int $limit = 100): array
    {
        $messages = $conversation->messages()
            ->with('sender:id,name')
            ->orderBy('id')
            ->limit($limit)
            ->get()
            ->map(fn (ChatMessage $m) => $this->messagePayload($m))
            ->values()
            ->all();

        return [
            'conversation' => $this->conversationPayload($conversation->loadMissing(['user', 'assignedAgent'])),
            'messages' => $messages,
        ];
    }

    public function sendMessage(
        Conversation $conversation,
        User $sender,
        string $body,
        string $role,
        ?string $clientMessageId = null,
        ?array $meta = null
    ): ChatMessage {
        $body = trim($body);
        if ($body === '') {
            throw ValidationException::withMessages(['body' => 'Pesan tidak boleh kosong.']);
        }

        if ($conversation->status === 'closed') {
            throw ValidationException::withMessages(['conversation' => 'Percakapan sudah ditutup.']);
        }

        if ($clientMessageId) {
            $existing = ChatMessage::query()
                ->where('conversation_id', $conversation->id)
                ->where('client_message_id', $clientMessageId)
                ->first();
            if ($existing) {
                return $existing;
            }
        }

        $message = DB::transaction(function () use ($conversation, $sender, $body, $role, $clientMessageId, $meta) {
            $msg = ChatMessage::create([
                'conversation_id' => $conversation->id,
                'sender_id' => $sender->id,
                'sender_role' => $role,
                'body' => $body,
                'client_message_id' => $clientMessageId,
                'meta' => $meta,
            ]);

            $updates = [
                'last_message_at' => now(),
                'last_message_preview' => Str::limit($body, 180),
            ];

            if ($role === 'user') {
                $updates['unread_agent'] = (int) $conversation->unread_agent + 1;
                if ($conversation->status === 'open') {
                    $updates['status'] = 'waiting';
                }
            } elseif ($role === 'agent') {
                $updates['unread_user'] = (int) $conversation->unread_user + 1;
                if (! $conversation->assigned_agent_id) {
                    $updates['assigned_agent_id'] = $sender->id;
                    $updates['status'] = 'assigned';
                }
            }

            $conversation->update($updates);

            return $msg;
        });

        $this->log('CHAT_MESSAGE_SENT', [
            'conversation_id' => $conversation->id,
            'message_id' => $message->id,
            'sender_role' => $role,
        ]);

        $payload = $this->messagePayload($message->load('sender:id,name'));
        $convPayload = $this->conversationPayload($conversation->fresh(['user', 'assignedAgent']));

        $this->realtime->publish('chat.conversation.'.$conversation->id, 'ChatMessageSent', $payload);
        $this->realtime->publish('chat.user.'.$conversation->user_id, 'ChatMessageSent', $payload);
        $this->realtime->publish('chat.agents', 'ConversationUpdated', $convPayload);

        if ($role === 'user') {
            $this->notifyDivision('customer_support', 'chat_new', 'Chat baru', Str::limit($body, 120), [
                'conversation_id' => $conversation->id,
            ], 'conversation', $conversation->id);
        } else {
            $this->realtime->publish('user.notifications.'.$conversation->user_id, 'ChatMessageSent', $payload);
        }

        return $message;
    }

    public function systemMessage(Conversation $conversation, string $body, ?array $meta = null): ChatMessage
    {
        $msg = ChatMessage::create([
            'conversation_id' => $conversation->id,
            'sender_id' => null,
            'sender_role' => 'system',
            'body' => $body,
            'meta' => $meta,
        ]);

        $conversation->update([
            'last_message_at' => now(),
            'last_message_preview' => Str::limit($body, 180),
        ]);

        $payload = $this->messagePayload($msg);
        $this->realtime->publish('chat.conversation.'.$conversation->id, 'ChatMessageSent', $payload);
        $this->realtime->publish('chat.user.'.$conversation->user_id, 'ChatMessageSent', $payload);
        $this->realtime->publish('chat.agents', 'ConversationUpdated', $this->conversationPayload($conversation->fresh(['user', 'assignedAgent'])));

        return $msg;
    }

    public function markRead(Conversation $conversation, User $reader, string $asRole): Conversation
    {
        if ($asRole === 'user' && (int) $conversation->user_id === (int) $reader->id) {
            $conversation->update(['unread_user' => 0]);
            ChatMessage::query()
                ->where('conversation_id', $conversation->id)
                ->where('sender_role', '!=', 'user')
                ->whereNull('read_at')
                ->update(['read_at' => now()]);
        }

        if ($asRole === 'agent') {
            $conversation->update(['unread_agent' => 0]);
            ChatMessage::query()
                ->where('conversation_id', $conversation->id)
                ->where('sender_role', 'user')
                ->whereNull('read_at')
                ->update(['read_at' => now()]);
        }

        $this->realtime->publish('chat.agents', 'ConversationUpdated', $this->conversationPayload($conversation->fresh(['user', 'assignedAgent'])));

        return $conversation->fresh();
    }

    public function assign(Conversation $conversation, User $agent): Conversation
    {
        $conversation->update([
            'assigned_agent_id' => $agent->id,
            'status' => 'assigned',
        ]);

        $this->systemMessage($conversation, $agent->name.' bergabung ke percakapan.');
        $this->log('CHAT_ASSIGNED', [
            'conversation_id' => $conversation->id,
            'agent_id' => $agent->id,
        ]);

        $this->realtime->publish('chat.agents', 'ConversationUpdated', $this->conversationPayload($conversation->fresh(['user', 'assignedAgent'])));

        return $conversation->fresh(['user', 'assignedAgent']);
    }

    public function close(Conversation $conversation, User $actor): Conversation
    {
        $conversation->update(['status' => 'closed']);
        $this->systemMessage($conversation, 'Percakapan ditutup oleh '.$actor->name.'.');
        $this->log('CHAT_CLOSED', ['conversation_id' => $conversation->id, 'actor_id' => $actor->id]);
        $this->realtime->publish('chat.agents', 'ConversationUpdated', $this->conversationPayload($conversation->fresh(['user', 'assignedAgent'])));

        return $conversation->fresh(['user', 'assignedAgent']);
    }

    /**
     * @return \Illuminate\Contracts\Pagination\LengthAwarePaginator
     */
    public function inbox(?string $status = null, ?string $keyword = null, int $perPage = 30)
    {
        $q = Conversation::query()
            ->with(['user:id,name,email,phone_number,role', 'assignedAgent:id,name'])
            ->orderByDesc('last_message_at')
            ->orderByDesc('id');

        if ($status && $status !== 'all') {
            $q->where('status', $status);
        }

        if ($keyword) {
            $q->where(function ($w) use ($keyword) {
                $w->where('subject', 'like', '%'.$keyword.'%')
                    ->orWhere('last_message_preview', 'like', '%'.$keyword.'%')
                    ->orWhereHas('user', function ($u) use ($keyword) {
                        $u->where('name', 'like', '%'.$keyword.'%')
                            ->orWhere('email', 'like', '%'.$keyword.'%')
                            ->orWhere('phone_number', 'like', '%'.$keyword.'%');
                    });
            });
        }

        return $q->paginate($perPage);
    }

    /**
     * @return array<string, mixed>
     */
    public function customerSnapshot(User $customer): array
    {
        $wallet = Wallet::query()->where('user_id', $customer->id)->first();
        $txCount = Transaction::query()->where('user_id', $customer->id)->count();
        $ticketCount = SupportTicket::query()->where('user_id', $customer->id)->count();
        $refundCount = Transaction::query()
            ->where('user_id', $customer->id)
            ->whereNotNull('refunded_at')
            ->count();

        return [
            'id' => $customer->id,
            'name' => $customer->name,
            'email' => $customer->email,
            'phoneNumber' => $customer->phone_number,
            'role' => $customer->role instanceof UserRole ? $customer->role->value : (string) $customer->role,
            'walletBalance' => $wallet?->balance !== null ? (float) $wallet->balance : 0,
            'registeredAt' => optional($customer->created_at)?->toIso8601String(),
            'transactionCount' => $txCount,
            'ticketCount' => $ticketCount,
            'refundCount' => $refundCount,
        ];
    }

    public function convertToTicket(
        Conversation $conversation,
        User $agent,
        ?string $category = null,
        ?string $priority = null
    ): SupportTicket {
        if ($conversation->support_ticket_id) {
            return SupportTicket::query()->findOrFail($conversation->support_ticket_id);
        }

        $ticket = DB::transaction(function () use ($conversation, $agent, $category, $priority) {
            $number = 'TKT-'.now()->format('ymd').'-'.strtoupper(Str::random(6));
            $ticket = SupportTicket::create([
                'ticket_number' => $number,
                'user_id' => $conversation->user_id,
                'transaction_id' => $conversation->transaction_id,
                'conversation_id' => $conversation->id,
                'category' => $category ?: 'Live Chat',
                'subject' => $conversation->subject ?: 'Tiket dari Live Chat',
                'description' => $conversation->last_message_preview,
                'priority' => $priority ?: 'Sedang',
                'status' => 'Terbuka',
                'source' => 'chat_convert',
            ]);

            $messages = $conversation->messages()->orderBy('id')->get();
            foreach ($messages as $msg) {
                $prefix = match ($msg->sender_role) {
                    'user' => '[User] ',
                    'agent' => '[CS] ',
                    default => '[System] ',
                };
                TicketReply::create([
                    'support_ticket_id' => $ticket->id,
                    'user_id' => $msg->sender_id ?: $agent->id,
                    'message' => $prefix.$msg->body,
                ]);
            }

            $conversation->update([
                'support_ticket_id' => $ticket->id,
            ]);

            return $ticket;
        });

        $this->systemMessage($conversation, 'Percakapan dikonversi menjadi tiket '.$ticket->ticket_number.'.');
        $this->log('CHAT_CONVERT_TICKET', [
            'conversation_id' => $conversation->id,
            'ticket_id' => $ticket->id,
            'agent_id' => $agent->id,
        ]);

        $this->notifyDivision('customer_support', 'ticket_created', 'Tiket dari chat', $ticket->ticket_number, [
            'ticket_id' => $ticket->id,
            'conversation_id' => $conversation->id,
        ], 'support_ticket', $ticket->id);

        $this->realtime->publish('chat.agents', 'TicketConvertedFromChat', [
            'conversationId' => $conversation->id,
            'ticketId' => $ticket->id,
            'ticketNumber' => $ticket->ticket_number,
        ]);

        return $ticket;
    }

    /**
     * @return array<string, int>
     */
    public function hubStats(): array
    {
        return [
            'liveChats' => Conversation::query()->whereIn('status', ['open', 'waiting', 'assigned'])->count(),
            'waitingReply' => Conversation::query()->where('status', 'waiting')->count(),
            'openTickets' => SupportTicket::query()->whereIn('status', ['Terbuka', 'Pending'])->count(),
            'openEscalations' => \App\Models\SupportEscalation::query()->whereIn('status', ['open', 'in_progress'])->count(),
            'pendingRefunds' => Transaction::query()
                ->whereIn('status', ['failed', 'canceled', 'cancelled'])
                ->whereNull('refunded_at')
                ->count(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function conversationPayload(Conversation $c): array
    {
        return [
            'id' => $c->id,
            'userId' => $c->user_id,
            'userName' => $c->user?->name,
            'userEmail' => $c->user?->email,
            'userPhone' => $c->user?->phone_number,
            'assignedAgentId' => $c->assigned_agent_id,
            'assignedAgentName' => $c->assignedAgent?->name,
            'status' => $c->status,
            'subject' => $c->subject,
            'lastMessageAt' => optional($c->last_message_at)?->toIso8601String(),
            'lastMessagePreview' => $c->last_message_preview,
            'unreadUser' => (int) $c->unread_user,
            'unreadAgent' => (int) $c->unread_agent,
            'supportTicketId' => $c->support_ticket_id,
            'transactionId' => $c->transaction_id,
            'createdAt' => optional($c->created_at)?->toIso8601String(),
            'updatedAt' => optional($c->updated_at)?->toIso8601String(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function messagePayload(ChatMessage $m): array
    {
        return [
            'id' => (string) $m->id,
            'conversationId' => (string) $m->conversation_id,
            'senderRole' => $m->sender_role,
            'senderId' => $m->sender_id ? (string) $m->sender_id : null,
            'senderName' => $m->sender?->name,
            'body' => $m->body,
            'clientMessageId' => $m->client_message_id,
            'meta' => $m->meta,
            'createdAt' => optional($m->created_at)?->toIso8601String(),
            'status' => $m->read_at ? 'read' : 'delivered',
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    protected function notifyDivision(
        string $role,
        string $type,
        string $title,
        ?string $body,
        array $payload,
        ?string $relatedType = null,
        ?int $relatedId = null
    ): void {
        DivisionNotification::create([
            'role' => $role,
            'type' => $type,
            'title' => $title,
            'body' => $body,
            'payload' => $payload,
            'related_type' => $relatedType,
            'related_id' => $relatedId,
        ]);

        $this->realtime->publish('division.'.$role, 'DivisionNotificationCreated', [
            'type' => $type,
            'title' => $title,
            'body' => $body,
            'payload' => $payload,
        ]);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    protected function log(string $activity, array $payload): void
    {
        ActivityLog::create([
            'user_id' => Auth::id(),
            'activity' => $activity,
            'payload' => $payload,
        ]);
    }
}
