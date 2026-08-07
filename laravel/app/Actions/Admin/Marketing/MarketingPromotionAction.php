<?php

namespace App\Actions\Admin\Marketing;

use App\Repositories\Contracts\MarketingRepositoryInterface;
use App\Models\BannerPromotion;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class MarketingPromotionAction
{
    public function __construct(
        protected MarketingRepositoryInterface $marketingRepository
    ) {}

    public function list(array $filters): LengthAwarePaginator
    {
        return $this->marketingRepository->getPromotions($filters);
    }

    public function create(array $data): BannerPromotion
    {
        $row = $this->marketingRepository->createPromotion($data);
        \App\Services\Website\CmsSyncService::publish(
            [\App\Services\Website\CmsSyncService::SCOPE_PROMOTION],
            'promotion_create'
        );

        return $row;
    }

    public function update(string|int $id, array $data): BannerPromotion
    {
        $row = $this->marketingRepository->updatePromotion($id, $data);
        \App\Services\Website\CmsSyncService::publish(
            [\App\Services\Website\CmsSyncService::SCOPE_PROMOTION],
            'promotion_update'
        );

        return $row;
    }

    public function delete(string|int $id): bool
    {
        $ok = $this->marketingRepository->deletePromotion($id);
        \App\Services\Website\CmsSyncService::publish(
            [\App\Services\Website\CmsSyncService::SCOPE_PROMOTION],
            'promotion_delete'
        );

        return $ok;
    }
}
