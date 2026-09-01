<?php

namespace App\Http\Controllers\Api\v1\Admin;

use App\Http\Controllers\Controller;
use App\Traits\ApiResponseTrait;
use App\Actions\Admin\CustomerSupport\CustomerSupportDashboardAction;
use App\Actions\Admin\CustomerSupport\TicketAction;
use App\Actions\Admin\CustomerSupport\CustomerAction;
use App\Actions\Admin\CustomerSupport\InvestigationAction;
use App\Actions\Admin\CustomerSupport\RefundQueueAction;
use App\Actions\Admin\CustomerSupport\KnowledgeBaseAction;
use App\Http\Requests\Admin\CustomerSupport\TicketFilterRequest;
use App\Http\Requests\Admin\CustomerSupport\ReplyTicketRequest;
use App\Http\Requests\Admin\CustomerSupport\UpdateStatusRequest;
use App\Http\Requests\Admin\CustomerSupport\CustomerFilterRequest;
use App\Http\Resources\SupportTicketResource;
use App\Http\Resources\TicketReplyResource;
use App\Http\Resources\CustomerResource;
use App\Http\Resources\TransactionResource;
use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerSupportController extends Controller
{
    use ApiResponseTrait;
    use \App\Http\Concerns\HandlesIdempotentRequests;

    /**
     * Get Customer Support Dashboard.
     * GET /api/v1/admin/customer-support/dashboard
     */
    public function dashboard(CustomerSupportDashboardAction $action): JsonResponse
    {
        $data = $action->execute();
        return $this->successResponse('Data dashboard customer support berhasil dimuat.', $data);
    }

    /**
     * Get Customer Support Stats.
     * GET /api/v1/admin/customer-support/stats
     */
    public function stats(CustomerSupportDashboardAction $action): JsonResponse
    {
        $data = $action->execute();
        return $this->successResponse('Statistik customer support berhasil dimuat.', $data);
    }

    /**
     * Get CS Staff Options (for ticket assignment dropdown).
     * GET /api/v1/admin/customer-support/staff
     */
    public function staffOptions(): JsonResponse
    {
        $staff = User::query()
            ->where('role', UserRole::CUSTOMER_SUPPORT->value)
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn ($u) => ['id' => $u->id, 'name' => $u->name]);

        return $this->successResponse('Daftar staff CS berhasil dimuat.', $staff);
    }

    /**
     * Get Paginated Support Tickets.
     * GET /api/v1/admin/customer-support/tickets
     */
    public function tickets(TicketFilterRequest $request, TicketAction $action): JsonResponse
    {
        $filters = $request->validated();
        $paginator = $action->list($filters);

        return $this->paginatedResponse(
            'Daftar tiket berhasil dimuat.',
            SupportTicketResource::collection($paginator->items()),
            [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ]
        );
    }

    /**
     * Get Ticket Details.
     * GET /api/v1/admin/customer-support/tickets/{id}
     */
    public function showTicket(string|int $id, TicketAction $action): JsonResponse
    {
        try {
            $ticket = $action->show($id);
            return $this->successResponse('Detail tiket berhasil dimuat.', new SupportTicketResource($ticket));
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return $this->errorResponse('Tiket tidak ditemukan.', 404);
        } catch (\Exception $e) {
            return $this->errorResponse($e->getMessage(), 400);
        }
    }

    /**
     * Reply to Support Ticket.
     * POST /api/v1/admin/customer-support/tickets/{id}/reply
     */
    public function replyTicket(string|int $id, ReplyTicketRequest $request, TicketAction $action): JsonResponse
    {
        try {
            $data = $request->validated();
            $reply = $action->reply($id, $data);
            return $this->successResponse('Balasan tiket berhasil dikirim.', new TicketReplyResource($reply), 201);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return $this->errorResponse('Tiket tidak ditemukan.', 404);
        } catch (\Exception $e) {
            return $this->errorResponse($e->getMessage(), 400);
        }
    }

    /**
     * Create a support ticket.
     * POST /api/v1/admin/customer-support/tickets
     */
    public function createTicket(Request $request, TicketAction $action): JsonResponse
    {
        $data = $request->validate([
            'customerEmail' => 'required_without:user_id|email',
            'customer_email' => 'nullable|email',
            'email' => 'nullable|email',
            'user_id' => 'nullable|integer|exists:users,id',
            'category' => 'required|string|max:100',
            'priority' => 'nullable|string|max:50',
            'status' => 'nullable|string|max:50',
            'subject' => 'nullable|string|max:500',
            'message' => 'nullable|string|max:5000',
            'transaction_id' => 'nullable|integer|exists:transactions,id',
        ]);

        try {
            $ticket = $action->create($data);
            return $this->successResponse('Tiket berhasil dibuat.', new SupportTicketResource($ticket), 201);
        } catch (\InvalidArgumentException $e) {
            return $this->errorResponse($e->getMessage(), 422);
        } catch (\Exception $e) {
            return $this->errorResponse($e->getMessage(), 400);
        }
    }

    /**
     * Update Support Ticket Status.
     * PUT /api/v1/admin/customer-support/tickets/{id}/status
     */
    public function updateStatus(string|int $id, UpdateStatusRequest $request, TicketAction $action): JsonResponse
    {
        try {
            $data = $request->validated();
            $ticket = $action->updateStatus($id, $data['status'], [
                'assigned_to' => $data['assigned_to'] ?? null,
            ]);
            return $this->successResponse('Status tiket berhasil diperbarui.', new SupportTicketResource($ticket));
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return $this->errorResponse('Tiket tidak ditemukan.', 404);
        } catch (\Exception $e) {
            return $this->errorResponse($e->getMessage(), 400);
        }
    }

    /**
     * Get Paginated Customers.
     * GET /api/v1/admin/customer-support/customers
     */
    public function customers(CustomerFilterRequest $request, CustomerAction $action): JsonResponse
    {
        $filters = $request->validated();
        $paginator = $action->list($filters);

        return $this->paginatedResponse(
            'Daftar pelanggan berhasil dimuat.',
            CustomerResource::collection($paginator->items()),
            [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ]
        );
    }

    /**
     * Get Customer Details.
     * GET /api/v1/admin/customer-support/customers/{id}
     */
    public function showCustomer(string|int $id, CustomerAction $action): JsonResponse
    {
        try {
            $customer = $action->show($id);
            return $this->successResponse('Detail pelanggan berhasil dimuat.', new CustomerResource($customer));
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return $this->errorResponse('Pelanggan tidak ditemukan.', 404);
        } catch (\Exception $e) {
            return $this->errorResponse($e->getMessage(), 400);
        }
    }

    /**
     * Get Customer Transaction History.
     * GET /api/v1/admin/customer-support/customers/{id}/transactions
     */
    public function customerTransactions(string|int $id, Request $request, CustomerAction $action): JsonResponse
    {
        try {
            $filters = $request->only(['search', 'status', 'per_page']);
            $paginator = $action->transactions($id, $filters);

            return $this->paginatedResponse(
                'Riwayat transaksi pelanggan berhasil dimuat.',
                TransactionResource::collection($paginator->items()),
                [
                    'current_page' => $paginator->currentPage(),
                    'last_page' => $paginator->lastPage(),
                    'per_page' => $paginator->perPage(),
                    'total' => $paginator->total(),
                ]
            );
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return $this->errorResponse('Pelanggan tidak ditemukan.', 404);
        } catch (\Exception $e) {
            return $this->errorResponse($e->getMessage(), 400);
        }
    }

    /**
     * Investigate Transaction.
     * GET /api/v1/admin/customer-support/investigations/{transaction}
     */
    public function investigation(string $transaction, InvestigationAction $action): JsonResponse
    {
        try {
            $data = $action->execute($transaction);
            
            // Format nested transaction
            $formattedTransaction = new TransactionResource($data['transaction']);
            
            return $this->successResponse('Data investigasi transaksi berhasil dimuat.', [
                'transaction' => $formattedTransaction,
                'wallet_mutation' => $data['wallet_mutation'],
                'digiflazz_logs' => $data['digiflazz_logs'],
                'midtrans_logs' => $data['midtrans_logs'],
                'activity_logs' => $data['activity_logs'],
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return $this->errorResponse('Transaksi tidak ditemukan.', 404);
        } catch (\Exception $e) {
            return $this->errorResponse($e->getMessage(), 400);
        }
    }

    /**
     * Investigate Transaction by query string.
     * GET /api/v1/admin/customer-support/investigation
     */
    public function investigationQuery(Request $request, InvestigationAction $action): JsonResponse
    {
        $transaction = $request->query('query')
            ?? $request->query('q')
            ?? $request->query('invoiceNumber')
            ?? $request->query('transactionId')
            ?? $request->query('invoice_number');

        return $this->investigation((string) $transaction, $action);
    }

    /**
     * Get Refund Queue.
     * GET /api/v1/admin/customer-support/refunds
     */
    public function refunds(Request $request, RefundQueueAction $action): JsonResponse
    {
        $filters = $request->only(['search', 'status', 'per_page']);
        $paginator = $action->execute($filters);

        return $this->paginatedResponse(
            'Daftar antrean pengembalian dana berhasil dimuat.',
            TransactionResource::collection($paginator->items()),
            [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ]
        );
    }

    /**
     * Get Refund Details.
     * GET /api/v1/admin/customer-support/refunds/{id}
     */
    public function showRefund(string|int $id, RefundQueueAction $action): JsonResponse
    {
        try {
            $transaction = $action->show($id);
            return $this->successResponse('Detail refund berhasil dimuat.', new TransactionResource($transaction));
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return $this->errorResponse('Refund tidak ditemukan.', 404);
        } catch (\Exception $e) {
            return $this->errorResponse($e->getMessage(), 400);
        }
    }

    /**
     * Create Refund Claim.
     * POST /api/v1/admin/customer-support/refunds
     */
    public function createRefund(Request $request, RefundQueueAction $action): JsonResponse
    {
        try {
            $data = $request->validate([
                'transaction_id' => 'nullable',
                'transactionId' => 'nullable',
                'invoice_number' => 'nullable|string',
                'reason' => 'nullable|string|max:500',
                'note' => 'nullable|string|max:500',
                'notes' => 'nullable|string|max:500',
            ]);
            $transaction = $action->create($data);
            return $this->successResponse('Pengajuan refund berhasil dibuat.', new TransactionResource($transaction), 201);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return $this->errorResponse('Transaksi tidak ditemukan.', 404);
        } catch (\InvalidArgumentException $e) {
            $code = $e->getCode() >= 400 && $e->getCode() < 600 ? $e->getCode() : 422;
            return $this->errorResponse($e->getMessage(), $code);
        } catch (\Exception $e) {
            return $this->errorResponse($e->getMessage(), 400);
        }
    }

    /**
     * Update Refund Claim (notes only).
     * PUT /api/v1/admin/customer-support/refunds/{id}
     * SRS 4.4.5 / Sprint 6 — CS MUST NOT perform balance-mutating approve/reject.
     */
    public function updateRefund(string|int $id, Request $request, RefundQueueAction $action): JsonResponse
    {
        try {
            $data = $request->validate([
                'status' => 'nullable|string|max:50',
                'reason' => 'nullable|string|max:500',
                'note' => 'nullable|string|max:500',
                'notes' => 'nullable|string|max:500',
            ]);

            $status = strtolower((string) ($data['status'] ?? ''));
            if (in_array($status, ['approved', 'approve', 'disetujui', 'rejected', 'reject', 'ditolak'], true)) {
                return $this->errorResponse(
                    'CS tidak berwenang menyetujui/menolak refund yang mengubah saldo. Eskalasikan ke Finance (FR-CS-07).',
                    403
                );
            }

            $transaction = $action->update($id, $data);
            return $this->successResponse('Refund berhasil diperbarui.', new TransactionResource($transaction));
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return $this->errorResponse('Refund tidak ditemukan.', 404);
        } catch (\InvalidArgumentException $e) {
            $code = $e->getCode() >= 400 && $e->getCode() < 600 ? (int) $e->getCode() : 422;
            return $this->errorResponse($e->getMessage(), $code);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return $this->errorResponse($e->getMessage(), 422, $e->errors());
        } catch (\Exception $e) {
            return $this->errorResponse($e->getMessage(), 400);
        }
    }

    /**
     * Escalate Refund Claim.
     * POST /api/v1/admin/customer-support/refunds/{id}/escalate
     */
    public function escalateRefund(string|int $id, Request $request, RefundQueueAction $action): JsonResponse
    {
        try {
            $data = $request->validate([
                'reason' => 'nullable|string|max:500',
                'note' => 'nullable|string|max:500',
                'notes' => 'nullable|string|max:500',
            ]);
            $transaction = $action->escalate($id, $data);
            return $this->successResponse('Refund berhasil dieskalasi.', new TransactionResource($transaction));
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return $this->errorResponse('Refund tidak ditemukan.', 404);
        } catch (\Exception $e) {
            return $this->errorResponse($e->getMessage(), 400);
        }
    }

    /**
     * Get Knowledge Base.
     * GET /api/v1/admin/customer-support/knowledge-base
     */
    public function knowledgeBase(KnowledgeBaseAction $action): JsonResponse
    {
        $data = $action->execute();
        return $this->successResponse('Data FAQ & SOP berhasil dimuat.', $data);
    }

    /**
     * Get a single knowledge-base article.
     * GET /api/v1/admin/customer-support/knowledge-base/{id}
     */
    public function knowledgeBaseArticle(string|int $id, KnowledgeBaseAction $action): JsonResponse
    {
        $article = $action->show($id);
        if (!$article) {
            return $this->errorResponse('Artikel knowledge base tidak ditemukan.', 404);
        }

        return $this->successResponse('Artikel knowledge base berhasil dimuat.', $article);
    }
}
