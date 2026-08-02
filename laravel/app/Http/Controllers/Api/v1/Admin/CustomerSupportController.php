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
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerSupportController extends Controller
{
    use ApiResponseTrait;

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
     * Update Support Ticket Status.
     * PUT /api/v1/admin/customer-support/tickets/{id}/status
     */
    public function updateStatus(string|int $id, UpdateStatusRequest $request, TicketAction $action): JsonResponse
    {
        try {
            $data = $request->validated();
            $ticket = $action->updateStatus($id, $data['status']);
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
     * Get Refund Queue.
     * GET /api/v1/admin/customer-support/refunds
     */
    public function refunds(CustomerFilterRequest $request, RefundQueueAction $action): JsonResponse
    {
        $filters = $request->validated();
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
     * Get Knowledge Base.
     * GET /api/v1/admin/customer-support/knowledge-base
     */
    public function knowledgeBase(KnowledgeBaseAction $action): JsonResponse
    {
        $data = $action->execute();
        return $this->successResponse('Data FAQ & SOP berhasil dimuat.', $data);
    }
}
