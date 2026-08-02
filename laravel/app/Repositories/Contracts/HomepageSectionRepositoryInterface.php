<?php

namespace App\Repositories\Contracts;

use App\Models\HomepageSection;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Pagination\LengthAwarePaginator;

interface HomepageSectionRepositoryInterface
{
    public function getPaginated(array $filters = []): LengthAwarePaginator;
    public function all(): Collection;
    public function findById(int $id): ?HomepageSection;
    public function findBySlug(string $slug): ?HomepageSection;
    public function create(array $data): HomepageSection;
    public function update(int $id, array $data): HomepageSection;
    public function delete(int $id): bool;
}
