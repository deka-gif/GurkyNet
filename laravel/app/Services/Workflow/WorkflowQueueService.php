<?php

namespace App\Services\Workflow;

use App\Enums\UserRole;
use App\Models\User;
use App\Models\Workflow;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class WorkflowQueueService
{
    public function __construct(
        protected WorkflowEngineService $engine
    ) {}

    /**
     * @param  array<string, mixed>  $filters
     */
    public function list(User $actor, array $filters = []): LengthAwarePaginator
    {
        $role = $actor->role instanceof UserRole ? $actor->role->value : (string) $actor->role;
        $requestedDivision = $filters['division'] ?? $filters['current_division'] ?? null;

        $query = Workflow::query()->with(['creator:id,name', 'assignee:id,name', 'transaction.user:id,name,email']);

        if (in_array($role, [UserRole::OWNER->value, UserRole::SUPER_ADMIN->value], true)) {
            // Global — optional filter
            if ($requestedDivision) {
                $query->where('current_division', $requestedDivision);
            }
        } elseif ($role === UserRole::CUSTOMER_SUPPORT->value) {
            // CS read-all
            if ($requestedDivision) {
                $query->where('current_division', $requestedDivision);
            }
        } elseif (in_array($role, [
            UserRole::OPERATIONS->value,
            UserRole::FINANCE->value,
            UserRole::MARKETING->value,
        ], true)) {
            $own = $role;
            if ($requestedDivision && $requestedDivision !== $own) {
                abort(403, 'Tidak dapat membuka queue divisi lain.');
            }
            $query->where('current_division', $own);
        } else {
            abort(403, 'Tidak berwenang melihat workflow.');
        }

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (! empty($filters['priority'])) {
            $query->where('priority', $filters['priority']);
        }

        if (! empty($filters['category'])) {
            $query->where('category', $filters['category']);
        }

        if (! empty($filters['q']) || ! empty($filters['keyword'])) {
            $q = $filters['q'] ?? $filters['keyword'];
            $query->where(function ($builder) use ($q) {
                $builder->where('title', 'like', '%'.$q.'%')
                    ->orWhere('workflow_code', 'like', '%'.$q.'%')
                    ->orWhere('description', 'like', '%'.$q.'%');
            });
        }

        if (($filters['open_only'] ?? null) === true || ($filters['open_only'] ?? null) === '1') {
            $query->whereNotIn('status', ['resolved', 'rejected', 'cancelled', 'closed']);
        }

        $perPage = (int) ($filters['per_page'] ?? $filters['perPage'] ?? 30);

        return $query
            ->orderByRaw("CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END")
            ->orderByDesc('updated_at')
            ->paginate(max(1, min(100, $perPage)));
    }

    public function findForActor(User $actor, int $id): Workflow
    {
        $workflow = Workflow::query()->with($this->engine->defaultRelations())->findOrFail($id);
        $this->assertCanView($actor, $workflow);

        return $workflow;
    }

    public function assertCanView(User $actor, Workflow $workflow): void
    {
        $role = $actor->role instanceof UserRole ? $actor->role->value : (string) $actor->role;

        if (in_array($role, [
            UserRole::OWNER->value,
            UserRole::SUPER_ADMIN->value,
            UserRole::CUSTOMER_SUPPORT->value,
        ], true)) {
            return;
        }

        if (in_array($role, [
            UserRole::OPERATIONS->value,
            UserRole::FINANCE->value,
            UserRole::MARKETING->value,
        ], true) && $workflow->current_division === $role) {
            return;
        }

        abort(403, 'Tidak berwenang melihat workflow ini.');
    }
}
