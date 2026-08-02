<?php

namespace App\Repositories\Contracts;

use App\Models\WebsiteMenu;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Pagination\LengthAwarePaginator;

interface WebsiteMenuRepositoryInterface
{
    public function getPaginated(array $filters = []): LengthAwarePaginator;
    public function all(): Collection;
    public function findById(int $id): ?WebsiteMenu;
    public function create(array $data): WebsiteMenu;
    public function update(int $id, array $data): WebsiteMenu;
    public function delete(int $id): bool;
}
