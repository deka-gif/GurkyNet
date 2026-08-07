<?php

namespace App\Actions\Admin\Marketing;

use App\Repositories\Contracts\MarketingRepositoryInterface;
use App\Models\BannerPromotion;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class MarketingVoucherAction
{
    public function __construct(
        protected MarketingRepositoryInterface $marketingRepository
    ) {}

    public function list(array $filters): LengthAwarePaginator
    {
        return $this->marketingRepository->getVouchers($filters);
    }

    public function create(array $data): BannerPromotion
    {
        $row = $this->marketingRepository->createVoucher($data);
        \App\Services\Website\CmsSyncService::publish(
            [\App\Services\Website\CmsSyncService::SCOPE_VOUCHER],
            'voucher_create'
        );

        return $row;
    }

    public function update(string|int $id, array $data): BannerPromotion
    {
        $row = $this->marketingRepository->updateVoucher($id, $data);
        \App\Services\Website\CmsSyncService::publish(
            [\App\Services\Website\CmsSyncService::SCOPE_VOUCHER],
            'voucher_update'
        );

        return $row;
    }

    public function delete(string|int $id): bool
    {
        $ok = $this->marketingRepository->deleteVoucher($id);
        \App\Services\Website\CmsSyncService::publish(
            [\App\Services\Website\CmsSyncService::SCOPE_VOUCHER],
            'voucher_delete'
        );

        return $ok;
    }
}
