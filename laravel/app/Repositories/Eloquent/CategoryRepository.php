<?php

namespace App\Repositories\Eloquent;

use App\Models\ProductCategory;
use App\Repositories\Contracts\CategoryRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;

class CategoryRepository implements CategoryRepositoryInterface
{
    public function all(): Collection
    {
        return ProductCategory::orderBy('id', 'asc')->get();
    }

    public function findBySlug(string $slug): ?ProductCategory
    {
        return ProductCategory::where('slug', $slug)->first();
    }

    public function findById(int $id): ?ProductCategory
    {
        return ProductCategory::find($id);
    }
}
