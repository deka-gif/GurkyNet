<?php

namespace App\Http\Controllers\Api\v1\Admin;

use App\Http\Controllers\Controller;
use App\Traits\ApiResponseTrait;
use App\Actions\Admin\Website\HomepageSectionAction;
use App\Http\Requests\Admin\Website\CreateHomepageSectionRequest;
use App\Http\Requests\Admin\Website\UpdateHomepageSectionRequest;
use App\Http\Resources\HomepageSectionResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HomepageSectionController extends Controller
{
    use ApiResponseTrait;

    public function __construct(
        protected HomepageSectionAction $action
    ) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->only(['visible', 'status', 'component_type', 'keyword', 'per_page']);
        $paginator = $this->action->listPaginated($filters);

        return $this->paginatedResponse(
            'Daftar homepage section berhasil dimuat.',
            HomepageSectionResource::collection($paginator->items()),
            $paginator
        );
    }

    public function store(CreateHomepageSectionRequest $request): JsonResponse
    {
        $data = $request->validated();
        $section = $this->action->create($data);

        return $this->successResponse(
            'Homepage section berhasil dibuat.',
            new HomepageSectionResource($section),
            201
        );
    }

    public function show(int $id): JsonResponse
    {
        $section = $this->action->findById($id);

        if (!$section) {
            return $this->errorResponse('Homepage section tidak ditemukan.', 404);
        }

        return $this->successResponse(
            'Detail homepage section berhasil dimuat.',
            new HomepageSectionResource($section)
        );
    }

    public function update(int $id, UpdateHomepageSectionRequest $request): JsonResponse
    {
        $section = $this->action->findById($id);

        if (!$section) {
            return $this->errorResponse('Homepage section tidak ditemukan.', 404);
        }

        $data = $request->validated();
        $updatedSection = $this->action->update($id, $data);

        return $this->successResponse(
            'Homepage section berhasil diperbarui.',
            new HomepageSectionResource($updatedSection)
        );
    }

    public function destroy(int $id): JsonResponse
    {
        $section = $this->action->findById($id);

        if (!$section) {
            return $this->errorResponse('Homepage section tidak ditemukan.', 404);
        }

        $this->action->delete($id);

        return $this->successResponse('Homepage section berhasil dihapus.');
    }
}
