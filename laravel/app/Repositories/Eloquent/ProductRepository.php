<?php

namespace App\Repositories\Eloquent;

use App\Models\Product;
use App\Repositories\Contracts\ProductRepositoryInterface;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;

class ProductRepository implements ProductRepositoryInterface
{
    public function getPaginatedProducts(array $filters = []): LengthAwarePaginator
    {
        $query = Product::query()->with(['category', 'provider']);

        // Filter by Category
        if (!empty($filters['category_id'])) {
            $query->where('product_category_id', $filters['category_id']);
        } elseif (!empty($filters['category'])) {
            $category = $filters['category'];
            if (is_numeric($category)) {
                $query->where('product_category_id', $category);
            } else {
                $query->whereHas('category', function ($q) use ($category) {
                    $q->where('slug', $category);
                });
            }
        }

        // Filter by Provider
        if (!empty($filters['provider_id'])) {
            $query->where('provider_id', $filters['provider_id']);
        } elseif (!empty($filters['provider'])) {
            $provider = $filters['provider'];
            if (is_numeric($provider)) {
                $query->where('provider_id', $provider);
            } else {
                $query->whereHas('provider', function ($q) use ($provider) {
                    $q->where('name', 'like', "%{$provider}%");
                });
            }
        }

        // Filter by Status (active/inactive)
        if (isset($filters['status'])) {
            $status = filter_var($filters['status'], FILTER_VALIDATE_BOOLEAN);
            $query->where('status', $status);
        }

        // Filter by Keyword (search in name or sku_code)
        if (!empty($filters['keyword'])) {
            $keyword = $filters['keyword'];
            $query->where(function ($q) use ($keyword) {
                $q->where('name', 'like', "%{$keyword}%")
                  ->orWhere('sku_code', 'like', "%{$keyword}%");
            });
        }

        $perPage = $filters['per_page'] ?? 15;

        return $query->latest()->paginate($perPage);
    }

    public function findById(int $id): ?Product
    {
        return Product::with(['category', 'provider'])->find($id);
    }

    public function findBySku(string $skuCode): ?Product
    {
        return Product::with(['category', 'provider'])->where('sku_code', $skuCode)->first();
    }

    public function getActiveProducts(): Collection
    {
        return Product::with(['category', 'provider'])->where('status', true)->get();
    }
}
