<?php

namespace App\Repositories\Contracts;

use App\Models\Provider;
use Illuminate\Database\Eloquent\Collection;

interface ProviderRepositoryInterface
{
    public function allActive(): Collection;
    public function findById(int $id): ?Provider;
    public function findByName(string $name): ?Provider;
    public function updateLogo(int $id, string $logo): ?Provider;
    /**
     * @param  array<int, array<string, mixed>>  $digiflazzProducts
     * @param  array<string, list<string>>  $seenSkusByListType  e.g. ['prepaid' => [...], 'pasca' => [...]]
     * @return array{inserted:int,updated:int,skipped:int,disabled:int,provider_sku_total:int,database_sku_total:int}
     */
    public function syncWithDigiflazz(array $digiflazzProducts, array $seenSkusByListType = []): array;
}