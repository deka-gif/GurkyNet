<?php

namespace App\Actions\Admin\Marketing;

use App\Repositories\Contracts\MarketingRepositoryInterface;
use App\Models\BannerPromotion;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class MarketingBannerAction
{
    public function __construct(
        protected MarketingRepositoryInterface $marketingRepository
    ) {}

    public function list(array $filters): LengthAwarePaginator
    {
        return $this->marketingRepository->getBanners($filters);
    }

    public function create(array $data): BannerPromotion
    {
        return $this->marketingRepository->createBanner($data);
    }

    public function update(string|int $id, array $data): BannerPromotion
    {
        return $this->marketingRepository->updateBanner($id, $data);
    }

    public function delete(string|int $id): bool
    {
        return $this->marketingRepository->deleteBanner($id);
    }
}
