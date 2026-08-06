<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Actions\Product\SearchProductAction;
use App\Http\Resources\ProductResource;
use App\Models\ProductCategory;
use App\Models\Provider;
use App\Services\Catalog\ProductMappingService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CatalogController extends Controller
{
    use ApiResponseTrait;

    public function __construct(
        protected ProductMappingService $mapping,
        protected SearchProductAction $searchProductAction
    ) {}

    /**
     * GurkyNet IA taxonomy for sidebar / hubs (never exposes Digi/VIP trees).
     */
    public function taxonomy(): JsonResponse
    {
        return $this->successResponse(
            'Taksonomi katalog GurkyNet.',
            $this->mapping->taxonomyForFrontend()
        );
    }

    /**
     * Unified catalog search: provider, product, category, layanan.
     */
    public function search(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', $request->query('keyword', '')));
        if ($q === '') {
            return $this->errorResponse('Parameter q wajib diisi.', 422);
        }

        $needle = Str::lower($q);
        $hubs = $this->mapping->taxonomyForFrontend();

        $matchedHubs = [];
        $matchedServices = [];
        foreach ($hubs as $hub) {
            if (str_contains(Str::lower($hub['label']), $needle) || str_contains(Str::lower($hub['key']), $needle)) {
                $matchedHubs[] = $hub;
            }
            foreach ($hub['children'] as $child) {
                if (
                    str_contains(Str::lower($child['label']), $needle)
                    || str_contains(Str::lower($child['key']), $needle)
                ) {
                    $matchedServices[] = array_merge($child, ['hub' => $hub['key'], 'hub_label' => $hub['label']]);
                }
            }
        }

        // Brand shortcuts (ML → Mobile Legends / game hub)
        $brandHits = Provider::query()
            ->where('is_active', true)
            ->where('name', 'like', '%'.$q.'%')
            ->orderBy('name')
            ->limit(20)
            ->get(['id', 'name']);

        $products = $this->searchProductAction->execute([
            'keyword' => $q,
            'per_page' => (int) $request->query('per_page', 30),
        ]);

        return $this->successResponse('Hasil pencarian katalog.', [
            'query' => $q,
            'hubs' => $matchedHubs,
            'services' => $matchedServices,
            'providers' => $brandHits,
            'products' => ProductResource::collection($products)->resolve(),
            'meta' => [
                'product_total' => method_exists($products, 'total') ? $products->total() : count($products),
            ],
        ]);
    }

    /**
     * Providers that have sellable products in a GurkyNet category.
     */
    public function providersByCategory(Request $request, string $category): JsonResponse
    {
        $slugs = $this->mapping->filterSlugs($category);
        $categoryIds = ProductCategory::query()
            ->whereIn('slug', $slugs)
            ->pluck('id');

        $providers = Provider::query()
            ->where('is_active', true)
            ->whereHas('products', function ($q) use ($categoryIds) {
                $q->whereIn('product_category_id', $categoryIds)
                    ->whereNull('deleted_at');
            })
            ->orderBy('name')
            ->get(['id', 'name', 'logo', 'is_active']);

        return $this->successResponse('Daftar provider kategori.', [
            'category' => $this->mapping->canonicalizeSlug($category),
            'providers' => $providers,
        ]);
    }
}
