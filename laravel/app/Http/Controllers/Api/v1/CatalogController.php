<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Actions\Product\SearchProductAction;
use App\Http\Resources\ProductResource;
use App\Models\ProductCategory;
use App\Models\Provider;
use App\Services\Catalog\ProductMappingService;
use App\Services\Pajak\PajakRegionService;
use App\Actions\Admin\Marketing\MarketingCategoryIconAction;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CatalogController extends Controller
{
    use ApiResponseTrait;

    public function __construct(
        protected ProductMappingService $mapping,
        protected SearchProductAction $searchProductAction,
        protected PajakRegionService $pajakRegions,
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
     * Flat {key: iconPath} map of every Marketing-uploaded category icon — customer app renders
     * these in place of the default Lucide icon when a key is present.
     */
    public function categoryIcons(MarketingCategoryIconAction $action): JsonResponse
    {
        return $this->successResponse('Peta icon kategori.', $action->publicMap());
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
     * Paket Data chips from Digi `type` (inventory-backed) — reusable for all operators.
     */
    protected function operatorDataTaxonomyResponse(string $operatorKey, string $message): JsonResponse
    {
        $payload = app(\App\Services\Catalog\DynamicOperatorDataTaxonomyService::class)
            ->taxonomyFor($operatorKey);

        return $this->successResponse($message, $payload);
    }

    public function telkomselDataTaxonomy(): JsonResponse
    {
        return $this->operatorDataTaxonomyResponse('telkomsel', 'Taksonomi Paket Data Telkomsel.');
    }

    public function xlDataTaxonomy(): JsonResponse
    {
        return $this->operatorDataTaxonomyResponse('xl', 'Taksonomi Paket Data XL.');
    }

    public function indosatDataTaxonomy(): JsonResponse
    {
        return $this->operatorDataTaxonomyResponse('indosat', 'Taksonomi Paket Data Indosat.');
    }

    public function triDataTaxonomy(): JsonResponse
    {
        return $this->operatorDataTaxonomyResponse('tri', 'Taksonomi Paket Data Tri.');
    }

    public function smartfrenDataTaxonomy(): JsonResponse
    {
        return $this->operatorDataTaxonomyResponse('smartfren', 'Taksonomi Paket Data Smartfren.');
    }

    public function axisDataTaxonomy(): JsonResponse
    {
        return $this->operatorDataTaxonomyResponse('axis', 'Taksonomi Paket Data AXIS.');
    }

    public function byuDataTaxonomy(): JsonResponse
    {
        return $this->operatorDataTaxonomyResponse('byu', 'Taksonomi Paket Data by.U.');
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

    /**
     * Provinsi → Kabupaten/Kota for PBB/SAMSAT, derived from live catalog SKUs.
     */
    public function pajakRegions(string $category): JsonResponse
    {
        $canonical = $this->mapping->canonicalizeSlug($category);
        if (!in_array($canonical, ['pbb', 'samsat'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Kategori pajak tidak valid.',
            ], 422);
        }

        $data = $this->pajakRegions->regionsForCategory($canonical);

        return $this->successResponse('Wilayah layanan pajak dari katalog provider.', [
            'category' => $canonical,
            'provinces' => $data['provinces'],
        ]);
    }

    /**
     * City→zone reference for Telkomsel Voucher Internet search assist (FR-OPS catalog UX).
     * Authoritative zone list remains products.zone_label from GET /products.
     */
    public function telkomselVoucherZones(): JsonResponse
    {
        /** @var array<string, list<string>> $zones */
        $zones = config('telkomsel_voucher_zones', []);

        return $this->successResponse('Referensi zona voucher internet Telkomsel.', [
            'zones' => $zones,
        ]);
    }
}
