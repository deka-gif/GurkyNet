<?php

namespace App\Repositories\Eloquent;

use App\Models\HomepageSection;
use App\Repositories\Contracts\HomepageSectionRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Pagination\LengthAwarePaginator;

class HomepageSectionRepository implements HomepageSectionRepositoryInterface
{
    public function getPaginated(array $filters = []): LengthAwarePaginator
    {
        $query = HomepageSection::query();

        if (isset($filters['visible'])) {
            $query->where('visible', filter_var($filters['visible'], FILTER_VALIDATE_BOOLEAN));
        }

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['component_type'])) {
            $query->where('component_type', $filters['component_type']);
        }

        if (!empty($filters['keyword'])) {
            $query->where('title', 'like', '%' . $filters['keyword'] . '%');
        }

        $perPage = $filters['per_page'] ?? 15;
        return $query->orderBy('display_order', 'asc')->paginate($perPage);
    }

    public function all(): Collection
    {
        return HomepageSection::orderBy('display_order', 'asc')->get();
    }

    public function findById(int $id): ?HomepageSection
    {
        return HomepageSection::find($id);
    }

    public function findBySlug(string $slug): ?HomepageSection
    {
        return HomepageSection::where('slug', $slug)->first();
    }

    public function create(array $data): HomepageSection
    {
        return HomepageSection::create($data);
    }

    public function update(int $id, array $data): HomepageSection
    {
        $section = HomepageSection::findOrFail($id);
        $section->update($data);
        return $section;
    }

    public function delete(int $id): bool
    {
        $section = HomepageSection::find($id);
        if ($section) {
            return $section->delete();
        }
        return false;
    }
}
