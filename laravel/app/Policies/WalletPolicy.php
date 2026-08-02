<?php

namespace App\Policies;

use App\Models\User;
use App\Models\Wallet;
use Illuminate\Auth\Access\HandlesAuthorization;

class WalletPolicy
{
    use HandlesAuthorization;

    /**
     * Determine whether the user can view the wallet.
     */
    public function view(User $user, Wallet $wallet): bool
    {
        if ($user->hasRole(
            \App\Enums\UserRole::SUPER_ADMIN,
            \App\Enums\UserRole::OWNER,
            \App\Enums\UserRole::FINANCE,
            \App\Enums\UserRole::CUSTOMER_SUPPORT
        )) {
            return true;
        }

        return $user->id === $wallet->user_id;
    }

    /**
     * Determine whether the user can view history or modify the wallet.
     */
    public function viewHistory(User $user, Wallet $wallet): bool
    {
        if ($user->hasRole(
            \App\Enums\UserRole::SUPER_ADMIN,
            \App\Enums\UserRole::OWNER,
            \App\Enums\UserRole::FINANCE,
            \App\Enums\UserRole::CUSTOMER_SUPPORT
        )) {
            return true;
        }

        return $user->id === $wallet->user_id;
    }
}
