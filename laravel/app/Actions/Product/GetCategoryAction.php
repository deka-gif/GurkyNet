<?php

namespace App\Actions\Product;

use App\Repositories\Contracts\CategoryRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;
use App\Models\ProductCategory;

class GetCategoryAction
{
    protected CategoryRepositoryInterface $categoryRepository;

    public function __construct(CategoryRepositoryInterface $categoryRepository)
    {
        $this->categoryRepository = $categoryRepository;
    }

    public function execute(?int $id = null, ?string $slug = null): mixed
    {
        if ($id !== null) {
            return $this->categoryRepository->findById($id);
        }

        if ($slug !== null) {
            return $this->categoryRepository->findBySlug($slug);
        }

        $cacheKey = 'product_categories_all';
        $ttl = 3600; // 1 hour

        try {
            return \Illuminate\Support\Facades\Cache::tags(['categories'])->remember($cacheKey, $ttl, function () {
                return $this->categoryRepository->all();
            });
        } catch (\BadMethodCallException $e) {
            return \Illuminate\Support\Facades\Cache::remember($cacheKey, $ttl, function () {
                return $this->categoryRepository->all();
            });
        }
    }
}
