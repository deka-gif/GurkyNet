<?php

namespace App\Actions\Admin\Website;

use App\Repositories\Contracts\WebsiteMenuRepositoryInterface;
use App\Models\WebsiteMenu;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;

class WebsiteMenuAction
{
    public function __construct(
        protected WebsiteMenuRepositoryInterface $repository
    ) {}

    public function listPaginated(array $filters): LengthAwarePaginator
    {
        return $this->repository->getPaginated($filters);
    }

    public function listAll(): Collection
    {
        return $this->repository->all();
    }

    public function findById(int $id): ?WebsiteMenu
    {
        return $this->repository->findById($id);
    }

    public function create(array $data): WebsiteMenu
    {
        return $this->repository->create($data);
    }

    public function update(int $id, array $data): WebsiteMenu
    {
        return $this->repository->update($id, $data);
    }

    public function delete(int $id): bool
    {
        return $this->repository->delete($id);
    }
}
