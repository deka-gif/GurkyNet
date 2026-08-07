<?php

namespace App\Actions\Admin\Website;

use App\Repositories\Contracts\WebsiteMenuRepositoryInterface;
use App\Models\WebsiteMenu;
use App\Services\Website\PublicHomepageCache;
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
        $menu = $this->repository->create($data);
        PublicHomepageCache::forget();

        return $menu;
    }

    public function update(int $id, array $data): WebsiteMenu
    {
        $menu = $this->repository->update($id, $data);
        PublicHomepageCache::forget();

        return $menu;
    }

    public function delete(int $id): bool
    {
        $ok = $this->repository->delete($id);
        PublicHomepageCache::forget();

        return $ok;
    }
}
