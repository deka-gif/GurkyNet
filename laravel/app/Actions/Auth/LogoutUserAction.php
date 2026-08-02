<?php

namespace App\Actions\Auth;

use App\Models\User;

class LogoutUserAction
{
    public function execute(User $user): bool
    {
        // Revoke the token that was used to authenticate the current request
        return $user->currentAccessToken()->delete();
    }
}
