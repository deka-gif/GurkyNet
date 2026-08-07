<?php

namespace App\Http\Controllers\Api\v1\Admin;

use App\Http\Controllers\Controller;
use App\Services\Website\HomepageBuilderService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Marketing Homepage Section Builder API (Sprint 7.2).
 */
class HomepageBuilderController extends Controller
{
    use ApiResponseTrait;

    public function __construct(
        protected HomepageBuilderService $builder
    ) {}

    public function show(): JsonResponse
    {
        return $this->successResponse(
            'Homepage Builder berhasil dimuat.',
            $this->builder->getBuilderState()
        );
    }

    public function saveDraft(Request $request): JsonResponse
    {
        $this->builder->assertCanDraft();

        $data = $request->validate([
            'sections' => 'required|array',
            'sections.*.title' => 'required|string|max:255',
            'sections.*.componentType' => 'required|string|max:64',
            'sections.*.slug' => 'nullable|string|max:255',
            'sections.*.enabled' => 'nullable|boolean',
            'sections.*.displayOrder' => 'nullable|integer',
            'sections.*.contentItems' => 'nullable|array',
            'sections.*.config' => 'nullable|array',
        ]);

        return $this->successResponse(
            'Draft Homepage berhasil disimpan.',
            $this->builder->saveDraft($data)
        );
    }

    public function reorder(Request $request): JsonResponse
    {
        $this->builder->assertCanDraft();

        $data = $request->validate([
            'orderedIds' => 'required|array|min:1',
            'orderedIds.*' => 'required',
        ]);

        return $this->successResponse(
            'Urutan section berhasil diperbarui (draft).',
            $this->builder->reorder($data['orderedIds'])
        );
    }

    public function discard(): JsonResponse
    {
        $this->builder->assertCanDraft();

        return $this->successResponse(
            'Draft dibuang — kembali ke versi published.',
            $this->builder->discardDraft()
        );
    }

    public function publish(Request $request): JsonResponse
    {
        $this->builder->assertCanPublish();

        $data = $request->validate([
            'label' => 'nullable|string|max:255',
        ]);

        return $this->successResponse(
            'Homepage berhasil dipublish.',
            $this->builder->publish($data['label'] ?? null)
        );
    }

    public function rollback(int $versionId): JsonResponse
    {
        $this->builder->assertCanPublish();

        return $this->successResponse(
            'Homepage berhasil di-rollback.',
            $this->builder->rollback($versionId)
        );
    }

    public function preview(): JsonResponse
    {
        return $this->successResponse(
            'Preview Homepage (draft) berhasil dimuat.',
            [
                'sections' => $this->builder->previewSections(),
                'mode' => 'draft_preview',
            ]
        );
    }

    public function permissions(): JsonResponse
    {
        return $this->successResponse(
            'Permission Homepage Builder.',
            $this->builder->permissions()
        );
    }
}
