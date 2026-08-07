<?php

namespace App\Actions\Admin\Website;

use App\Repositories\Contracts\HomepageSectionRepositoryInterface;
use App\Models\HomepageSection;
use App\Services\Website\PublicHomepageCache;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;

class HomepageSectionAction
{
    public function __construct(
        protected HomepageSectionRepositoryInterface $repository
    ) {}

    public function listPaginated(array $filters): LengthAwarePaginator
    {
        return $this->repository->getPaginated($filters);
    }

    public function listAll(): Collection
    {
        return $this->repository->all();
    }

    public function findById(int $id): ?HomepageSection
    {
        return $this->repository->findById($id);
    }

    public function create(array $data): HomepageSection
    {
        $section = $this->repository->create($data);
        PublicHomepageCache::forget();

        return $section;
    }

    public function update(int $id, array $data): HomepageSection
    {
        $section = $this->repository->update($id, $data);
        PublicHomepageCache::forget();

        return $section;
    }

    public function delete(int $id): bool
    {
        $ok = $this->repository->delete($id);
        PublicHomepageCache::forget();

        return $ok;
    }
}
