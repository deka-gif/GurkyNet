<?php

namespace App\Services\Realtime;

use App\Contracts\Realtime\RealtimeTransport;
use App\Enums\UserRole;
use App\Models\Conversation;
use App\Models\User;

class RealtimeChannelAuthorizer
{
    public function canSubscribe(User $user, string $channel): bool
    {
        $role = $user->role instanceof UserRole ? $user->role->value : (string) $user->role;

        if (in_array($role, [UserRole::OWNER->value, UserRole::SUPER_ADMIN->value], true)) {
            return true;
        }

        if (preg_match('/^chat\.user\.(\d+)$/', $channel, $m)) {
            return (int) $m[1] === (int) $user->id;
        }

        if (preg_match('/^user\.notifications\.(\d+)$/', $channel, $m)) {
            return (int) $m[1] === (int) $user->id;
        }

        if (preg_match('/^chat\.conversation\.(\d+)$/', $channel, $m)) {
            $conv = Conversation::query()->find((int) $m[1]);
            if (! $conv) {
                return false;
            }
            if ((int) $conv->user_id === (int) $user->id) {
                return true;
            }

            return in_array($role, [
                UserRole::CUSTOMER_SUPPORT->value,
                UserRole::OWNER->value,
                UserRole::SUPER_ADMIN->value,
            ], true);
        }

        if ($channel === 'chat.agents') {
            return in_array($role, [
                UserRole::CUSTOMER_SUPPORT->value,
                UserRole::OWNER->value,
                UserRole::SUPER_ADMIN->value,
            ], true);
        }

        if (preg_match('/^division\.(operations|finance|marketing|customer_support)$/', $channel, $m)) {
            $map = [
                'operations' => UserRole::OPERATIONS->value,
                'finance' => UserRole::FINANCE->value,
                'marketing' => UserRole::MARKETING->value,
                'customer_support' => UserRole::CUSTOMER_SUPPORT->value,
            ];

            return ($map[$m[1]] ?? null) === $role
                || in_array($role, [UserRole::OWNER->value, UserRole::SUPER_ADMIN->value], true);
        }

        if (preg_match('/^workflow\.(\d+)$/', $channel, $m)) {
            if (in_array($role, [
                UserRole::CUSTOMER_SUPPORT->value,
                UserRole::OWNER->value,
                UserRole::SUPER_ADMIN->value,
            ], true)) {
                return true;
            }

            $workflow = \App\Models\Workflow::query()->find((int) $m[1]);
            if (! $workflow) {
                return false;
            }

            return $workflow->current_division === $role;
        }

        return false;
    }
}
