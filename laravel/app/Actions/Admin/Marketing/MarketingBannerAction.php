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
        $banner = $this->marketingRepository->createBanner($data);
        \App\Services\Website\PublicHomepageCache::forget();

        return $banner;
    }

    public function update(string|int $id, array $data): BannerPromotion
    {
        $banner = $this->marketingRepository->updateBanner($id, $data);
        \App\Services\Website\PublicHomepageCache::forget();

        return $banner;
    }

    public function delete(string|int $id): bool
    {
        $ok = $this->marketingRepository->deleteBanner($id);
        \App\Services\Website\PublicHomepageCache::forget();

        return $ok;
    }
