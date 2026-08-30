<?php

namespace App\Http\Controllers\Api\v1\Admin;

use App\Http\Controllers\Controller;
use App\Traits\ApiResponseTrait;
use App\Actions\Admin\Marketing\MarketingDashboardAction;
use App\Actions\Admin\Marketing\MarketingBannerAction;
use App\Actions\Admin\Marketing\MarketingPromotionAction;
use App\Actions\Admin\Marketing\MarketingVoucherAction;
use App\Actions\Admin\Marketing\MarketingAnnouncementAction;
use App\Actions\Admin\Marketing\MarketingBrandLogoAction;
use App\Actions\Admin\Marketing\MarketingCategoryIconAction;
use App\Http\Requests\Admin\Marketing\MarketingFilterRequest;
use App\Http\Requests\Admin\Marketing\CreateBannerRequest;
use App\Http\Requests\Admin\Marketing\UpdateBannerRequest;
use App\Http\Requests\Admin\Marketing\CreatePromotionRequest;
use App\Http\Requests\Admin\Marketing\UpdatePromotionRequest;
use App\Http\Requests\Admin\Marketing\CreateVoucherRequest;
use App\Http\Requests\Admin\Marketing\UpdateVoucherRequest;
use App\Http\Requests\Admin\Marketing\CreateAnnouncementRequest;
use App\Http\Requests\Admin\Marketing\UpdateAnnouncementRequest;
use App\Http\Resources\BannerResource;
use App\Http\Resources\PromotionResource;
use App\Http\Resources\VoucherResource;
use App\Http\Resources\AnnouncementResource;
use App\Http\Resources\ProductResource;
use App\Http\Resources\ProviderResource;
use App\Models\HomepageFeaturedProduct;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class MarketingController extends Controller
{
    use ApiResponseTrait;

    /**
     * Get Marketing Dashboard.
     * GET /api/v1/admin/marketing/dashboard
     */
    public function dashboard(MarketingDashboardAction $action): JsonResponse
    {
        $data = $action->execute();
        return $this->successResponse('Data dashboard pemasaran berhasil dimuat.', $data);
    }

    /**
     * Get Paginated Banners.
     * GET /api/v1/admin/marketing/banners
     */
    public function banners(MarketingFilterRequest $request, MarketingBannerAction $action): JsonResponse
    {
        $filters = $request->validated();
        $paginator = $action->list($filters);

        return $this->paginatedResponse(
            'Daftar banner berhasil dimuat.',
            BannerResource::collection($paginator->items()),
            [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ]
        );
    }

    /**
     * Create Banner.
     * POST /api/v1/admin/marketing/banners
     */
    public function storeBanner(CreateBannerRequest $request, MarketingBannerAction $action): JsonResponse
    {
        $data = $request->validated();
        $banner = $action->create($data);

        return $this->successResponse('Banner berhasil dibuat.', new BannerResource($banner), 201);
    }

    /**
     * Update Banner.
     * PUT /api/v1/admin/marketing/banners/{id}
     */
    public function updateBanner(string|int $id, UpdateBannerRequest $request, MarketingBannerAction $action): JsonResponse
    {
        try {
            $data = $request->validated();
            $banner = $action->update($id, $data);
            return $this->successResponse('Banner berhasil diperbarui.', new BannerResource($banner));
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return $this->errorResponse('Banner tidak ditemukan.', 404);
        } catch (\Exception $e) {
            return $this->errorResponse($e->getMessage(), 400);
        }
    }

    /**
     * Soft Delete Banner.
     * DELETE /api/v1/admin/marketing/banners/{id}
     */
    public function destroyBanner(string|int $id, MarketingBannerAction $action): JsonResponse
    {
        try {
            $action->delete($id);
            return $this->successResponse('Banner berhasil dihapus.');
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return $this->errorResponse('Banner tidak ditemukan.', 404);
        } catch (\Exception $e) {
            return $this->errorResponse($e->getMessage(), 400);
        }
    }

    /**
     * Get Paginated Promotions.
     * GET /api/v1/admin/marketing/promotions
     */
    public function promotions(MarketingFilterRequest $request, MarketingPromotionAction $action): JsonResponse
    {
        $filters = $request->validated();
        $paginator = $action->list($filters);

        return $this->paginatedResponse(
            'Daftar promosi berhasil dimuat.',
            PromotionResource::collection($paginator->items()),
            [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ]
        );
    }

    /**
     * Create Promotion.
     * POST /api/v1/admin/marketing/promotions
     */
    public function storePromotion(CreatePromotionRequest $request, MarketingPromotionAction $action): JsonResponse
    {
        $data = $request->validated();
        $promotion = $action->create($data);

        return $this->successResponse('Promosi berhasil dibuat.', new PromotionResource($promotion), 201);
    }

    /**
     * Update Promotion.
     * PUT /api/v1/admin/marketing/promotions/{id}
     */
    public function updatePromotion(string|int $id, UpdatePromotionRequest $request, MarketingPromotionAction $action): JsonResponse
    {
        try {
            $data = $request->validated();
            $promotion = $action->update($id, $data);
            return $this->successResponse('Promosi berhasil diperbarui.', new PromotionResource($promotion));
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return $this->errorResponse('Promosi tidak ditemukan.', 404);
        } catch (\Exception $e) {
            return $this->errorResponse($e->getMessage(), 400);
        }
    }

    /**
     * Soft Delete Promotion.
     * DELETE /api/v1/admin/marketing/promotions/{id}
     */
    public function destroyPromotion(string|int $id, MarketingPromotionAction $action): JsonResponse
    {
        try {
            $action->delete($id);
            return $this->successResponse('Promosi berhasil dihapus.');
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return $this->errorResponse('Promosi tidak ditemukan.', 404);
        } catch (\Exception $e) {
            return $this->errorResponse($e->getMessage(), 400);
        }
    }

    /**
     * Get Paginated Vouchers.
     * GET /api/v1/admin/marketing/vouchers
     */
    public function vouchers(MarketingFilterRequest $request, MarketingVoucherAction $action): JsonResponse
    {
        $filters = $request->validated();
        $paginator = $action->list($filters);

        return $this->paginatedResponse(
            'Daftar voucher berhasil dimuat.',
            VoucherResource::collection($paginator->items()),
            [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ]
        );
    }

    /**
     * Create Voucher.
     * POST /api/v1/admin/marketing/vouchers
     */
    public function storeVoucher(CreateVoucherRequest $request, MarketingVoucherAction $action): JsonResponse
    {
        $data = $request->validated();
        $voucher = $action->create($data);

        return $this->successResponse('Voucher berhasil dibuat.', new VoucherResource($voucher), 201);
    }

    /**
     * Update Voucher.
     * PUT /api/v1/admin/marketing/vouchers/{id}
     */
    public function updateVoucher(string|int $id, UpdateVoucherRequest $request, MarketingVoucherAction $action): JsonResponse
    {
        try {
            $data = $request->validated();
            $voucher = $action->update($id, $data);
            return $this->successResponse('Voucher berhasil diperbarui.', new VoucherResource($voucher));
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return $this->errorResponse('Voucher tidak ditemukan.', 404);
        } catch (\Exception $e) {
            return $this->errorResponse($e->getMessage(), 400);
        }
    }

    /**
     * Soft Delete Voucher.
     * DELETE /api/v1/admin/marketing/vouchers/{id}
     */
    public function destroyVoucher(string|int $id, MarketingVoucherAction $action): JsonResponse
    {
        try {
            $action->delete($id);
            return $this->successResponse('Voucher berhasil dihapus.');
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return $this->errorResponse('Voucher tidak ditemukan.', 404);
        } catch (\Exception $e) {
            return $this->errorResponse($e->getMessage(), 400);
        }
    }

    /**
     * Get Paginated Announcements.
     * GET /api/v1/admin/marketing/announcements
     */
    public function announcements(MarketingFilterRequest $request, MarketingAnnouncementAction $action): JsonResponse
    {
        $filters = $request->validated();
        $paginator = $action->list($filters);

        return $this->paginatedResponse(
            'Daftar pengumuman berhasil dimuat.',
            AnnouncementResource::collection($paginator->items()),
            [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ]
        );
    }

    /**
     * Create Announcement.
     * POST /api/v1/admin/marketing/announcements
     */
    public function storeAnnouncement(CreateAnnouncementRequest $request, MarketingAnnouncementAction $action): JsonResponse
    {
        $data = $request->validated();
        $announcement = $action->create($data);

        return $this->successResponse('Pengumuman berhasil dibuat.', new AnnouncementResource($announcement), 201);
    }

    /**
     * Update Announcement.
     * PUT /api/v1/admin/marketing/announcements/{id}
     */
    public function updateAnnouncement(string|int $id, UpdateAnnouncementRequest $request, MarketingAnnouncementAction $action): JsonResponse
    {
        try {
            $data = $request->validated();
            $announcement = $action->update($id, $data);
            return $this->successResponse('Pengumuman berhasil diperbarui.', new AnnouncementResource($announcement));
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return $this->errorResponse('Pengumuman tidak ditemukan.', 404);
        } catch (\Exception $e) {
            return $this->errorResponse($e->getMessage(), 400);
        }
    }

    /**
     * Soft Delete Announcement.
     * DELETE /api/v1/admin/marketing/announcements/{id}
     */
    public function destroyAnnouncement(string|int $id, MarketingAnnouncementAction $action): JsonResponse
    {
        try {
            $action->delete($id);
            return $this->successResponse('Pengumuman berhasil dihapus.');
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return $this->errorResponse('Pengumuman tidak ditemukan.', 404);
        } catch (\Exception $e) {
            return $this->errorResponse($e->getMessage(), 400);
        }
    }

    public function featuredProducts(Request $request): JsonResponse
    {
        $items = HomepageFeaturedProduct::query()
            ->with([
                'product.category',
                'product.provider',
                'product.productProvider',
                'product.providerSkus.productProvider',
            ])
            ->orderBy('display_order')
            ->get();

        return $this->successResponse('Daftar featured products berhasil dimuat.', $items->map(function (HomepageFeaturedProduct $item) {
            return [
                'id' => $item->id,
                'display_order' => (int) $item->display_order,
                'is_active' => (bool) $item->is_active,
                'product' => $item->product ? (new ProductResource($item->product))->resolve() : null,
                'product_id' => $item->product_id,
            ];
        })->values());
    }

    public function storeFeaturedProduct(Request $request): JsonResponse
    {
        $data = $request->validate([
            'product_id' => 'required|exists:products,id',
            'display_order' => 'nullable|integer|min:1',
            'is_active' => 'nullable|boolean',
        ]);

        $featured = HomepageFeaturedProduct::updateOrCreate(
            ['product_id' => $data['product_id']],
            [
                'display_order' => $data['display_order'] ?? (HomepageFeaturedProduct::max('display_order') + 1),
                'is_active' => $data['is_active'] ?? true,
            ]
        )->load([
            'product.category',
            'product.provider',
            'product.productProvider',
            'product.providerSkus.productProvider',
        ]);

        \App\Services\Website\PublicHomepageCache::forget();

        return $this->successResponse('Featured product berhasil ditambahkan.', [
            'id' => $featured->id,
            'display_order' => (int) $featured->display_order,
            'is_active' => (bool) $featured->is_active,
            'product' => $featured->product ? (new ProductResource($featured->product))->resolve() : null,
            'product_id' => $featured->product_id,
        ], 201);
    }

    public function updateFeaturedProduct(string|int $id, Request $request): JsonResponse
    {
        $data = $request->validate([
            'display_order' => 'nullable|integer|min:1',
            'is_active' => 'nullable|boolean',
            'product_id' => 'nullable|exists:products,id',
        ]);

        /** @var HomepageFeaturedProduct $featured */
        $featured = HomepageFeaturedProduct::query()->findOrFail($id);
        $featured->fill($data)->save();
        $featured->load([
            'product.category',
            'product.provider',
            'product.productProvider',
            'product.providerSkus.productProvider',
        ]);

        \App\Services\Website\PublicHomepageCache::forget();

        return $this->successResponse('Featured product berhasil diperbarui.', [
            'id' => $featured->id,
            'display_order' => (int) $featured->display_order,
            'is_active' => (bool) $featured->is_active,
            'product' => $featured->product ? (new ProductResource($featured->product))->resolve() : null,
            'product_id' => $featured->product_id,
        ]);
    }

    public function destroyFeaturedProduct(string|int $id): JsonResponse
    {
        $featured = HomepageFeaturedProduct::query()->findOrFail($id);
        $featured->delete();
        \App\Services\Website\PublicHomepageCache::forget();

        return $this->successResponse('Featured product berhasil dihapus.');
    }

    /**
     * List brands (Provider) currently live/visible to customers, for logo upload.
     * GET /api/v1/admin/marketing/brand-logos
     */
    public function brandLogos(MarketingBrandLogoAction $action): JsonResponse
    {
        return $this->successResponse('Daftar brand berhasil dimuat.', $action->list());
    }

    /**
     * Set/replace a brand's logo. Takes effect immediately for every customer.
     * PUT /api/v1/admin/marketing/brand-logos/{id}
     */
    public function updateBrandLogo(string|int $id, Request $request, MarketingBrandLogoAction $action): JsonResponse
    {
        $data = $request->validate([
            'logo' => 'required|string|max:500',
        ]);

        try {
            $provider = $action->setLogo((int) $id, $data['logo']);

            return $this->successResponse('Logo brand berhasil diperbarui.', new ProviderResource($provider));
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return $this->errorResponse('Brand tidak ditemukan.', 404);
        }
    }

    /**
     * List category icons grouped by hub, for the Marketing admin icon-upload UI.
     * GET /api/v1/admin/marketing/category-icons
     */
    public function categoryIcons(MarketingCategoryIconAction $action): JsonResponse
    {
        return $this->successResponse('Daftar icon kategori berhasil dimuat.', $action->list());
    }

    /**
     * Set/replace/clear one category icon. Takes effect immediately for every customer.
     * PUT /api/v1/admin/marketing/category-icons/{key}
     */
    public function updateCategoryIcon(string $key, Request $request, MarketingCategoryIconAction $action): JsonResponse
    {
        $data = $request->validate([
            'icon' => 'nullable|string|max:500',
        ]);

        try {
            $icon = $action->setIcon($key, $data['icon'] ?? null);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return $this->errorResponse($e->getMessage(), 422);
        }

        return $this->successResponse('Icon kategori berhasil diperbarui.', $icon);
    }
}
