<?php

namespace App\Actions\Admin\Website;

use App\Repositories\Contracts\WebsiteSettingRepositoryInterface;
use App\Models\WebsiteSetting;
use Illuminate\Database\Eloquent\Collection;

class WebsiteSettingAction
{
    public function __construct(
        protected WebsiteSettingRepositoryInterface $repository
    ) {}

    public function list(): Collection
    {
        return $this->repository->all();
    }

    public function getLatest(): ?WebsiteSetting
    {
        return $this->repository->getLatest();
    }

    public function findById(int $id): ?WebsiteSetting
    {
        return $this->repository->findById($id);
    }

    public function create(array $data): WebsiteSetting
    {
        return $this->repository->create($data);
    }

    public function update(int $id, array $data): WebsiteSetting
    {
        return $this->repository->update($id, $data);
    }

    public function delete(int $id): bool
    {
        return $this->repository->delete($id);
    }
}
