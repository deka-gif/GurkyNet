<?php

namespace App\Actions\Admin\Marketing;

use App\Repositories\Contracts\MarketingRepositoryInterface;
use App\Models\Notification;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class MarketingAnnouncementAction
{
    public function __construct(
        protected MarketingRepositoryInterface $marketingRepository
    ) {}

    public function list(array $filters): LengthAwarePaginator
    {
        return $this->marketingRepository->getAnnouncements($filters);
    }

    public function create(array $data): Notification
    {
        $row = $this->marketingRepository->createAnnouncement($data);
        \App\Services\Website\CmsSyncService::publish(
            [\App\Services\Website\CmsSyncService::SCOPE_ANNOUNCEMENT],
            'announcement_create'
        );

        return $row;
    }

    public function update(string|int $id, array $data): Notification
    {
        $row = $this->marketingRepository->updateAnnouncement($id, $data);
        \App\Services\Website\CmsSyncService::publish(
            [\App\Services\Website\CmsSyncService::SCOPE_ANNOUNCEMENT],
            'announcement_update'
        );

        return $row;
    }

    public function delete(string|int $id): bool
    {
        $ok = $this->marketingRepository->deleteAnnouncement($id);
        \App\Services\Website\CmsSyncService::publish(
            [\App\Services\Website\CmsSyncService::SCOPE_ANNOUNCEMENT],
            'announcement_delete'
        );

        return $ok;
    }
}
