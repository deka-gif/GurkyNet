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
        return $this->marketingRepository->createAnnouncement($data);
    }

    public function update(string|int $id, array $data): Notification
    {
        return $this->marketingRepository->updateAnnouncement($id, $data);
    }

    public function delete(string|int $id): bool
    {
        return $this->marketingRepository->deleteAnnouncement($id);
    }
}
