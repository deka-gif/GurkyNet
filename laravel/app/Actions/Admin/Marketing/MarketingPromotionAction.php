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
        return $this->marketingRepository->createPromotion($data);
    }

    public function update(string|int $id, array $data): BannerPromotion
    {
        return $this->marketingRepository->updatePromotion($id, $data);
    }

    public function delete(string|int $id): bool
    {
        return $this->marketingRepository->deletePromotion($id);
    }
}
