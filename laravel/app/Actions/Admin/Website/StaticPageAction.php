<?php

namespace App\Actions\Admin\Website;

use App\Repositories\Contracts\StaticPageRepositoryInterface;
use App\Models\StaticPage;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;

class StaticPageAction
{
    public function __construct(
        protected StaticPageRepositoryInterface $repository
    ) {}

    public function listPaginated(array $filters): LengthAwarePaginator
    {
        return $this->repository->getPaginated($filters);
    }

    public function listAll(): Collection
    {
        return $this->repository->all();
    }

    public function findById(int $id): ?StaticPage
    {
        return $this->repository->findById($id);
    }

    public function findBySlug(string $slug): ?StaticPage
    {
        return $this->repository->findBySlug($slug);
    }

    public function create(array $data): StaticPage
    {
        return $this->repository->create($data);
    }

    public function update(int $id, array $data): StaticPage
    {
        return $this->repository->update($id, $data);
    }

    public function delete(int $id): bool
    {
        return $this->repository->delete($id);
    }
}
