<?php

namespace App\Actions\Profile;

use App\Repositories\Contracts\ProfileRepositoryInterface;
use App\Models\User;

class ProfileAction
{
    public function __construct(
        protected ProfileRepositoryInterface $profileRepository
    ) {}

    public function getProfile(User $user): array
    {
        return $this->profileRepository->getProfileData($user);
    }

    public function updateProfile(User $user, array $data): User
    {
        return $this->profileRepository->updateProfile($user, $data);
    }

    /**
     * Update customer notification channel preferences.
     *
     * @param  array{notify_transactions?:bool,notify_announcements?:bool,notify_promotions?:bool}  $prefs
     */
    public function updateNotificationPreference(User $user, array $prefs): User
    {
        $fill = [];
        foreach (['notify_transactions', 'notify_announcements', 'notify_promotions'] as $key) {
            if (array_key_exists($key, $prefs)) {
                $fill[$key] = (bool) $prefs[$key];
            }
        }

        if ($fill !== []) {
            $user->forceFill($fill)->save();
        }

        return $user->fresh();
    }
}
