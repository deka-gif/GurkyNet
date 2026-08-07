<?php

namespace App\Http\Controllers\Api\v1\Admin;

use App\Http\Controllers\Controller;
use App\Services\Website\LegalCenterService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Marketing Legal Center CMS API (Sprint 7.3).
 */
class LegalCenterController extends Controller
{
    use ApiResponseTrait;

    public function __construct(
        protected LegalCenterService $legal
    ) {}

    public function index(): JsonResponse
    {
        return $this->successResponse(
            'Legal Center berhasil dimuat.',
            $this->legal->listForCms()
        );
    }

    public function show(string $slug): JsonResponse
    {
        return $this->successResponse(
            'Dokumen legal berhasil dimuat.',
            $this->legal->showForCms($slug)
        );
    }

    public function saveDraft(Request $request, string $slug): JsonResponse
    {
        $data = $request->validate([
            'title' => 'nullable|string|max:255',
            'draftContent' => 'nullable|string',
            'draft_content' => 'nullable|string',
            'seoTitle' => 'nullable|string|max:255',
            'seo_title' => 'nullable|string|max:255',
            'seoDescription' => 'nullable|string|max:1000',
            'seo_description' => 'nullable|string|max:1000',
            'seoKeywords' => 'nullable|string|max:500',
            'seo_keywords' => 'nullable|string|max:500',
            'canonicalUrl' => 'nullable|string|max:500',
            'canonical_url' => 'nullable|string|max:500',
            'ogImage' => 'nullable|string|max:500',
            'og_image' => 'nullable|string|max:500',
        ]);

        return $this->successResponse(
            'Draft dokumen legal berhasil disimpan.',
            $this->legal->saveDraft($slug, $data)
        );
    }

    public function discard(string $slug): JsonResponse
    {
        return $this->successResponse(
            'Draft dibuang — kembali ke versi published.',
            $this->legal->discardDraft($slug)
        );
    }

    public function publish(Request $request, string $slug): JsonResponse
    {
        $data = $request->validate([
            'label' => 'nullable|string|max:255',
        ]);

        return $this->successResponse(
            'Dokumen legal berhasil dipublish.',
            $this->legal->publish($slug, $data['label'] ?? null)
        );
    }

    public function rollback(Request $request, string $slug, int $versionId): JsonResponse
    {
        return $this->successResponse(
            'Dokumen legal berhasil di-rollback.',
            $this->legal->rollback($slug, $versionId)
        );
    }

    public function preview(string $slug): JsonResponse
    {
        $this->legal->assertCanView();
        $doc = $this->legal->publicDocument($slug, previewDraft: true);
        if (! $doc) {
            return $this->errorResponse('Dokumen tidak ditemukan.', 404);
        }

        return $this->successResponse('Preview draft Legal Center.', $doc);
    }

    public function permissions(): JsonResponse
    {
        return $this->successResponse(
            'Permission Legal Center.',
            $this->legal->permissions()
        );
    }
}
