<?php

namespace App\Services\Support;

use App\Models\DivisionNotification;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class DivisionNotificationService
{
    public function listForUser(User $user, int $perPage = 30): LengthAwarePaginator
    {
        $role = $user->role instanceof \App\Enums\UserRole ? $user->role->value : (string) $user->role;

        return DivisionNotification::query()
            ->where(function ($q) use ($user, $role) {
                $q->where('role', $role)
                    ->orWhere('user_id', $user->id);
                if (in_array($role, ['owner', 'super_admin'], true)) {
                    $q->orWhereIn('role', ['customer_support', 'operations', 'finance', 'marketing', 'owner']);
                }
            })
            ->orderByDesc('id')
            ->paginate($perPage);
    }

    public function markRead(DivisionNotification $n, User $user): DivisionNotification
    {
        $n->update(['read_at' => now()]);

        return $n;
    }

    public function markAllRead(User $user): int
    {
        $role = $user->role instanceof \App\Enums\UserRole ? $user->role->value : (string) $user->role;

        return DivisionNotification::query()
            ->whereNull('read_at')
            ->where(function ($q) use ($user, $role) {
                $q->where('role', $role)->orWhere('user_id', $user->id);
            })
            ->update(['read_at' => now()]);
    }

    public function unreadCount(User $user): int
    {
        $role = $user->role instanceof \App\Enums\UserRole ? $user->role->value : (string) $user->role;

        return DivisionNotification::query()
            ->whereNull('read_at')
            ->where(function ($q) use ($user, $role) {
                $q->where('role', $role)->orWhere('user_id', $user->id);
            })
            ->count();
    }
}
