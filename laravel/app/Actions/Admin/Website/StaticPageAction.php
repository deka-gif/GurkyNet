<?php

namespace App\Actions\Admin\Website;

use App\Repositories\Contracts\StaticPageRepositoryInterface;
use App\Models\StaticPage;
use App\Services\Website\PublicHomepageCache;
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
        $page = $this->repository->create($data);
        PublicHomepageCache::forget(\App\Services\Website\CmsSyncService::SCOPE_STATIC_PAGE, 'static_page_create');

        return $page;
    }

    public function update(int $id, array $data): StaticPage
    {
        $page = $this->repository->update($id, $data);
        PublicHomepageCache::forget(\App\Services\Website\CmsSyncService::SCOPE_STATIC_PAGE, 'static_page_update');

        return $page;
    }

    public function delete(int $id): bool
    {
        $ok = $this->repository->delete($id);
        PublicHomepageCache::forget(\App\Services\Website\CmsSyncService::SCOPE_STATIC_PAGE, 'static_page_delete');

        return $ok;
    }
}
