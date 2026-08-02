<?php

namespace App\Repositories\Contracts;

use App\Models\ProductCategory;
use Illuminate\Database\Eloquent\Collection;

interface CategoryRepositoryInterface
{
    public function all(): Collection;
    public function findBySlug(string $slug): ?ProductCategory;
    public function findById(int $id): ?ProductCategory;
}
