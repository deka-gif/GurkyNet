<?php

namespace App\Actions\Product;

use App\Repositories\Contracts\CategoryRepositoryInterface;
use App\Services\Catalog\CustomerFacingCategoryLister;

class GetCategoryAction
{
    public function __construct(
        protected CategoryRepositoryInterface $categoryRepository,
        protected CustomerFacingCategoryLister $customerFacingCategories,
    ) {}

    public function execute(?int $id = null, ?string $slug = null): mixed
    {
        if ($id !== null) {
            return $this->categoryRepository->findById($id);
        }

        if ($slug !== null) {
            $category = $this->categoryRepository->findBySlug($slug);
            // Hide raw/legacy provider taxonomy from direct slug lookup for menus.
            if ($category && $this->customerFacingCategories->isHiddenRawSlug((string) $category->slug)) {
                return null;
            }
            if ($category) {
                $meta = config('gurky_catalog.categories.'.$category->slug);
                if (is_array($meta) && ! empty($meta['name'])) {
                    $category->name = (string) $meta['name'];
                }
            }

            return $category;
        }

        // Digi-backed customer-facing list (no raw orphan rows in "Lainnya").
        return $this->customerFacingCategories->list();
    }
}
