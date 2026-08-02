<?php

namespace App\Repositories\Contracts;

use App\Models\Provider;
use Illuminate\Database\Eloquent\Collection;

interface ProviderRepositoryInterface
{
    public function allActive(): Collection;
    public function findById(int $id): ?Provider;
    public function findByName(string $name): ?Provider;
    public function syncWithDigiflazz(array $digiflazzProducts): void;
}
