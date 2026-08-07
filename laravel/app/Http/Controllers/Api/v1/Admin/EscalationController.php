<?php

namespace App\Http\Controllers\Api\v1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Workflow;
use App\Services\Support\DivisionNotificationService;
use App\Services\Workflow\WorkflowActionService;
use App\Services\Workflow\WorkflowEngineService;
use App\Services\Workflow\WorkflowQueueService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Division queues — Sprint 8.2 reads Workflows (SSOT).
 * Legacy path /admin/escalations/* kept as compatibility alias.
 */
class EscalationController extends Controller
{
    use ApiResponseTrait;

    public function __construct(
        protected WorkflowQueueService $queue,
        protected WorkflowEngineService $engine,
        protected WorkflowActionService $actions,
        protected DivisionNotificationService $notifications
    ) {}

    public function index(Request $request, string $division): JsonResponse
    {
        $this->assertDivisionAccess($request, $division);

        $paginator = $this->queue->list($request->user(), [
            'division' => $division,
            'status' => $request->query('status'),
            'per_page' => (int) $request->query('per_page', 30),
            'open_only' => $request->query('open_only'),
        ]);

        $items = collect($paginator->items())->map(function (Workflow $w) {
            $payload = $this->engine->payload($w);

            // Compat shape for older FE
            return array_merge($payload, [
                'targetDivision' => $w->current_division,
                'type' => $w->category,
                'fromUserName' => $payload['createdByName'],
                'resolutionNote' => $w->meta['last_resolution_note'] ?? null,
            ]);
        });

        return $this->successResponse('Antrian workflow.', [
            'data' => $items,
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $workflow = Workflow::query()->findOrFail($id);
        $this->queue->assertCanView($request->user(), $workflow);

        $data = $request->validate([
            'status' => 'required|string|max:64',
            'resolutionNote' => 'nullable|string|max:5000',
            'resolution_note' => 'nullable|string|max:5000',
        ]);

        $note = $data['resolutionNote'] ?? $data['resolution_note'] ?? null;
        $status = $data['status'];

        // Map legacy escalation statuses → workflow actions
        $updated = match ($status) {
            'open' => $workflow,
            'in_progress' => $this->engine->assign($workflow, $request->user(), $request->user(), false),
            'resolved' => $this->actions->execute($workflow, $request->user(), [
                'action' => 'resolve',
                'note' => $note,
            ]),
            'rejected' => $this->actions->execute($workflow, $request->user(), [
                'action' => 'reject',
                'note' => $note,
            ]),
            'closed' => $this->engine->close($workflow, $request->user(), $note),
            default => $this->engine->transitionStatus($workflow, $request->user(), $status, $note),
        };

        return $this->successResponse('Status workflow diperbarui.', $this->engine->payload($updated));
    }

    public function notifications(Request $request): JsonResponse
    {
        $paginator = $this->notifications->listForUser($request->user());

        return $this->successResponse('Notifikasi divisi.', [
            'data' => $paginator->items(),
            'unreadCount' => $this->notifications->unreadCount($request->user()),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    public function markNotificationRead(Request $request, int $id): JsonResponse
    {
        $n = \App\Models\DivisionNotification::query()->findOrFail($id);
        $this->notifications->markRead($n, $request->user());

        return $this->successResponse('Notifikasi dibaca.', $n->fresh());
    }

    public function markAllNotificationsRead(Request $request): JsonResponse
    {
        $count = $this->notifications->markAllRead($request->user());

        return $this->successResponse('Semua notifikasi dibaca.', ['updated' => $count]);
    }

    protected function assertDivisionAccess(Request $request, string $division): void
    {
        $role = $request->user()->role instanceof \App\Enums\UserRole
            ? $request->user()->role->value
            : (string) $request->user()->role;

        if (in_array($role, ['owner', 'super_admin'], true)) {
            return;
        }

        $map = [
            'operations' => 'operations',
            'finance' => 'finance',
            'marketing' => 'marketing',
            'customer_support' => 'customer_support',
        ];

        if (($map[$division] ?? null) !== $role) {
            abort(403, 'Akses antrian divisi ditolak.');
        }
    }
}
