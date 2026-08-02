<?php

namespace App\Repositories\Contracts;

use App\Models\StaticPage;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Pagination\LengthAwarePaginator;

interface StaticPageRepositoryInterface
{
    public function getPaginated(array $filters = []): LengthAwarePaginator;
    public function all(): Collection;
    public function findById(int $id): ?StaticPage;
    public function findBySlug(string $slug): ?StaticPage;
    public function create(array $data): StaticPage;
    public function update(int $id, array $data): StaticPage;
    public function delete(int $id): bool;
}
