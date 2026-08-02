<?php

namespace App\Actions\Product;

use App\Repositories\Contracts\ProviderRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Cache;

class GetProviderAction
{
    protected ProviderRepositoryInterface $providerRepository;

    public function __construct(ProviderRepositoryInterface $providerRepository)
    {
        $this->providerRepository = $providerRepository;
    }

    public function execute(?int $id = null): mixed
    {
        if ($id !== null) {
            return $this->providerRepository->findById($id);
        }

        $cacheKey = 'providers_active_all';
        $ttl = 3600; // 1 hour

        try {
            return Cache::tags(['providers'])->remember($cacheKey, $ttl, function () {
                return $this->providerRepository->allActive();
            });
        } catch (\BadMethodCallException $e) {
            return Cache::remember($cacheKey, $ttl, function () {
                return $this->providerRepository->allActive();
            });
        }
    }
}
