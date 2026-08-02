<?php

namespace App\Repositories\Eloquent;

use App\Models\WebsiteMenu;
use App\Repositories\Contracts\WebsiteMenuRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Pagination\LengthAwarePaginator;

class WebsiteMenuRepository implements WebsiteMenuRepositoryInterface
{
    public function getPaginated(array $filters = []): LengthAwarePaginator
    {
        $query = WebsiteMenu::query()->with('parent');

        if (isset($filters['visible'])) {
            $query->where('visible', filter_var($filters['visible'], FILTER_VALIDATE_BOOLEAN));
        }

        if (isset($filters['parent_only']) && filter_var($filters['parent_only'], FILTER_VALIDATE_BOOLEAN)) {
            $query->whereNull('parent_id');
        }

        if (!empty($filters['keyword'])) {
            $query->where('title', 'like', '%' . $filters['keyword'] . '%');
        }

        $perPage = $filters['per_page'] ?? 15;
        return $query->orderBy('display_order', 'asc')->paginate($perPage);
    }

    public function all(): Collection
    {
        return WebsiteMenu::with('children')->whereNull('parent_id')->orderBy('display_order', 'asc')->get();
    }

    public function findById(int $id): ?WebsiteMenu
    {
        return WebsiteMenu::with(['parent', 'children'])->find($id);
    }

    public function create(array $data): WebsiteMenu
    {
        return WebsiteMenu::create($data);
    }

    public function update(int $id, array $data): WebsiteMenu
    {
        $menu = WebsiteMenu::findOrFail($id);
        $menu->update($data);
        return $menu;
    }

    public function delete(int $id): bool
    {
        $menu = WebsiteMenu::find($id);
        if ($menu) {
            return $menu->delete();
        }
        return false;
    }
}
