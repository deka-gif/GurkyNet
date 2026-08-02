<?php

namespace App\Repositories\Contracts;

use App\Models\WebsiteSetting;
use Illuminate\Database\Eloquent\Collection;

interface WebsiteSettingRepositoryInterface
{
    public function all(): Collection;
    public function findById(int $id): ?WebsiteSetting;
    public function getLatest(): ?WebsiteSetting;
    public function create(array $data): WebsiteSetting;
    public function update(int $id, array $data): WebsiteSetting;
    public function delete(int $id): bool;
}
