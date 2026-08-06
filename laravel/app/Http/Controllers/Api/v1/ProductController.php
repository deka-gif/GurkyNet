<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Actions\Product\GetCategoryAction;
use App\Actions\Product\GetProductAction;
use App\Actions\Product\SearchProductAction;
use App\Actions\Product\GetProviderAction;
use App\Http\Resources\CategoryResource;
use App\Http\Resources\ProviderResource;
use App\Http\Resources\ProductResource;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class ProductController extends Controller
{
    use ApiResponseTrait;

    protected GetCategoryAction $getCategoryAction;
    protected GetProductAction $getProductAction;
    protected SearchProductAction $searchProductAction;
    protected GetProviderAction $getProviderAction;

    public function __construct(
        GetCategoryAction $getCategoryAction,
        GetProductAction $getProductAction,
        SearchProductAction $searchProductAction,
        GetProviderAction $getProviderAction
    ) {
        $this->getCategoryAction = $getCategoryAction;
        $this->getProductAction = $getProductAction;
        $this->searchProductAction = $searchProductAction;
        $this->getProviderAction = $getProviderAction;
    }

    /**
     * Get list of categories.
     */
    public function indexCategories(): JsonResponse
    {
        $categories = $this->getCategoryAction->execute();
        return $this->successResponse('Daftar kategori produk berhasil didapatkan.', CategoryResource::collection($categories));
    }

    /**
     * Get detail of a category by slug.
     */
    public function showCategory(string $slug): JsonResponse
    {
        $category = $this->getCategoryAction->execute(null, $slug);

        if (!$category) {
            return $this->errorResponse('Kategori tidak ditemukan.', 404);
        }

        return $this->successResponse('Detail kategori berhasil didapatkan.', new CategoryResource($category));
    }

    /**
     * Get list of providers.
     */
    public function indexProviders(): JsonResponse
    {
        $providers = $this->getProviderAction->execute();
        return $this->successResponse('Daftar provider berhasil didapatkan.', ProviderResource::collection($providers));
    }

    /**
     * Get list of products with pagination, lazy loading, and filters.
     */
    public function indexProducts(Request $request): JsonResponse
    {
        $filters = $request->only([
            'category', 'provider', 'status', 'keyword', 'per_page', 'page',
            'telkomsel_group', 'data_group', 'sort',
        ]);
        
        $paginatedProducts = $this->searchProductAction->execute($filters);

        $resourceCollection = ProductResource::collection($paginatedProducts);

        return $this->paginatedResponse(
            'Daftar produk berhasil didapatkan.',
            $resourceCollection,
            $paginatedProducts
        );
    }

    /**
     * Get detail of a product by SKU code.
     */
    public function showProduct(string $skuCode): JsonResponse
    {
        $product = $this->getProductAction->executeBySku($skuCode);

        if (!$product) {
            return $this->errorResponse('Produk tidak ditemukan.', 404);
        }

        return $this->successResponse('Detail produk berhasil didapatkan.', new ProductResource($product));
    }
}
