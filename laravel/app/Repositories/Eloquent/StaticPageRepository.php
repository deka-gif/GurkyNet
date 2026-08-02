<?php

namespace App\Repositories\Eloquent;

use App\Models\StaticPage;
use App\Repositories\Contracts\StaticPageRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Pagination\LengthAwarePaginator;

class StaticPageRepository implements StaticPageRepositoryInterface
{
    public function getPaginated(array $filters = []): LengthAwarePaginator
    {
        $query = StaticPage::query();

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['keyword'])) {
            $query->where(function($q) use ($filters) {
                $q->where('title', 'like', '%' . $filters['keyword'] . '%')
                  ->orWhere('content', 'like', '%' . $filters['keyword'] . '%');
            });
        }

        $perPage = $filters['per_page'] ?? 15;
        return $query->latest('id')->paginate($perPage);
    }

    public function all(): Collection
    {
        return StaticPage::all();
    }

    public function findById(int $id): ?StaticPage
    {
        return StaticPage::find($id);
    }

    public function findBySlug(string $slug): ?StaticPage
    {
        return StaticPage::where('slug', $slug)->first();
    }

    public function create(array $data): StaticPage
    {
        return StaticPage::create($data);
    }

    public function update(int $id, array $data): StaticPage
    {
        $page = StaticPage::findOrFail($id);
        $page->update($data);
        return $page;
    }

    public function delete(int $id): bool
    {
        $page = StaticPage::find($id);
        if ($page) {
            return $page->delete();
        }
        return false;
    }
}
