<?php

namespace App\Http\Controllers\Api\v1\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Workflow;
use App\Services\Workflow\WorkflowActionService;
use App\Services\Workflow\WorkflowEngineService;
use App\Services\Workflow\WorkflowQueueService;
use App\Services\Workflow\WorkflowStatsService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WorkflowController extends Controller
{
    use ApiResponseTrait;

    public function __construct(
        protected WorkflowEngineService $engine,
        protected WorkflowQueueService $queue,
        protected WorkflowActionService $actions,
        protected WorkflowStatsService $stats
    ) {}

    public function index(Request $request): JsonResponse
    {
        $paginator = $this->queue->list($request->user(), $request->query());
        $items = collect($paginator->items())->map(fn (Workflow $w) => $this->engine->payload($w));

        return $this->successResponse('Workflow queue.', [
            'data' => $items,
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $workflow = $this->queue->findForActor($request->user(), $id);

        return $this->successResponse('Workflow detail.', $this->engine->payload($workflow));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string|max:10000',
            'category' => 'nullable|string|max:64',
            'priority' => 'nullable|string|max:32',
            'targetDivision' => 'nullable|in:operations,finance,marketing',
            'target_division' => 'nullable|in:operations,finance,marketing',
            'source' => 'nullable|in:chat,ticket,manual,system',
            'conversationId' => 'nullable|integer|exists:conversations,id',
            'conversation_id' => 'nullable|integer|exists:conversations,id',
            'supportTicketId' => 'nullable|integer|exists:support_tickets,id',
            'support_ticket_id' => 'nullable|integer|exists:support_tickets,id',
            'transactionId' => 'nullable|integer|exists:transactions,id',
            'transaction_id' => 'nullable|integer|exists:transactions,id',
            'type' => 'nullable|string|max:64',
        ]);

        $target = $data['targetDivision'] ?? $data['target_division'] ?? null;
        if ($target) {
            $workflow = $this->engine->createFromCs($request->user(), $data);
        } else {
            $workflow = $this->engine->create($request->user(), array_merge($data, [
                'current_division' => 'customer_support',
                'status' => 'waiting_cs',
                'category' => $data['category'] ?? 'other_ops',
            ]));
        }

        return $this->successResponse('Workflow dibuat.', $this->engine->payload($workflow), 201);
    }

    public function escalate(Request $request, int $id): JsonResponse
    {
        $workflow = $this->queue->findForActor($request->user(), $id);
        $data = $request->validate([
            'targetDivision' => 'required|in:operations,finance,marketing,admin,customer_support',
            'target_division' => 'nullable|in:operations,finance,marketing,admin,customer_support',
            'note' => 'nullable|string|max:5000',
        ]);

        $target = $data['targetDivision'] ?? $data['target_division'];
        $workflow = $this->engine->escalate($workflow, $request->user(), $target, $data['note'] ?? null);

        return $this->successResponse('Workflow dieskalasi.', $this->engine->payload($workflow));
    }

    public function action(Request $request, int $id): JsonResponse
    {
        $workflow = $this->queue->findForActor($request->user(), $id);
        $data = $request->validate([
            'action' => 'required|string|max:64',
            'note' => 'nullable|string|max:5000',
            'resolutionNote' => 'nullable|string|max:5000',
            'resolution_note' => 'nullable|string|max:5000',
            'payload' => 'nullable|array',
        ]);

        $workflow = $this->actions->execute($workflow, $request->user(), $data);

        return $this->successResponse('Aksi workflow dijalankan.', $this->engine->payload($workflow));
    }

    public function close(Request $request, int $id): JsonResponse
    {
        $workflow = $this->queue->findForActor($request->user(), $id);
        $data = $request->validate(['note' => 'nullable|string|max:5000']);
        $workflow = $this->engine->close($workflow, $request->user(), $data['note'] ?? null);

        return $this->successResponse('Workflow ditutup.', $this->engine->payload($workflow));
    }

    public function assign(Request $request, int $id): JsonResponse
    {
        $this->assertOwner($request->user());
        $workflow = Workflow::query()->findOrFail($id);
        $data = $request->validate([
            'assignedTo' => 'required|integer|exists:users,id',
            'assigned_to' => 'nullable|integer|exists:users,id',
        ]);
        $assignee = User::query()->findOrFail($data['assignedTo'] ?? $data['assigned_to']);
        $workflow = $this->engine->assign($workflow, $request->user(), $assignee, false);

        return $this->successResponse('Workflow di-assign.', $this->engine->payload($workflow));
    }

    public function reassign(Request $request, int $id): JsonResponse
    {
        $this->assertOwner($request->user());
        $workflow = Workflow::query()->findOrFail($id);
        $data = $request->validate([
            'assignedTo' => 'required|integer|exists:users,id',
            'assigned_to' => 'nullable|integer|exists:users,id',
        ]);
        $assignee = User::query()->findOrFail($data['assignedTo'] ?? $data['assigned_to']);
        $workflow = $this->engine->assign($workflow, $request->user(), $assignee, true);

        return $this->successResponse('Workflow di-reassign.', $this->engine->payload($workflow));
    }

    public function override(Request $request, int $id): JsonResponse
    {
        $this->assertOwner($request->user());
        $workflow = Workflow::query()->findOrFail($id);
        $data = $request->validate([
            'status' => 'required|in:'.implode(',', Workflow::STATUSES),
            'note' => 'nullable|string|max:5000',
        ]);
        $workflow = $this->engine->overrideStatus($workflow, $request->user(), $data['status'], $data['note'] ?? null);

        return $this->successResponse('Workflow di-override.', $this->engine->payload($workflow));
    }

    public function forceResolve(Request $request, int $id): JsonResponse
    {
        $this->assertOwner($request->user());
        $workflow = Workflow::query()->findOrFail($id);
        $data = $request->validate(['note' => 'nullable|string|max:5000']);
        $workflow = $this->engine->forceResolve($workflow, $request->user(), $data['note'] ?? null);

        return $this->successResponse('Workflow force-resolved.', $this->engine->payload($workflow));
    }

    public function stats(Request $request, string $division): JsonResponse
    {
        $allowed = ['customer-support', 'customer_support', 'operations', 'finance', 'marketing', 'admin', 'owner'];
        if (! in_array($division, $allowed, true)) {
            return $this->errorResponse('Divisi stats tidak valid.', 422);
        }

        $key = str_replace('-', '_', $division);

        return $this->successResponse('Workflow stats.', $this->stats->forDivision($key));
    }

    protected function assertOwner(User $user): void
    {
        $role = $user->role instanceof \App\Enums\UserRole ? $user->role->value : (string) $user->role;
        if (! in_array($role, ['owner', 'super_admin'], true)) {
            abort(403, 'Hanya Admin/Owner.');
        }
    }
}
