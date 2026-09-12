<?php

namespace App\Services\AccountDeletion;

use App\Enums\AccountDeletionStatus;
use App\Exceptions\AccountDeletionException;
use App\Models\User;

/**
 * Blocks money-moving actions while customer is in pending_deletion grace period.
 */
class AccountDeletionGate
{
    public function assertNotPendingDeletion(User $user): void
    {
        if ($this->isPendingDeletion($user)) {
            throw AccountDeletionException::pendingDeletionBlocksMoney();
        }
    }

    public function isPendingDeletion(User $user): bool
    {
        return (string) $user->deletion_status === AccountDeletionStatus::PENDING_DELETION->value;
    }
}
