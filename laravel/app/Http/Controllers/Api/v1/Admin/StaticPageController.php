<?php

namespace App\Http\Controllers\Api\v1\Admin;

use App\Http\Controllers\Controller;
use App\Traits\ApiResponseTrait;
use App\Actions\Admin\Website\StaticPageAction;
use App\Http\Requests\Admin\Website\CreateStaticPageRequest;
use App\Http\Requests\Admin\Website\UpdateStaticPageRequest;
use App\Http\Resources\StaticPageResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StaticPageController extends Controller
{
    use ApiResponseTrait;

    public function __construct(
        protected StaticPageAction $action
    ) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->only(['status', 'keyword', 'per_page']);
        $paginator = $this->action->listPaginated($filters);

        return $this->paginatedResponse(
            'Daftar halaman statis berhasil dimuat.',
            StaticPageResource::collection($paginator->items()),
            $paginator
        );
    }

    public function store(CreateStaticPageRequest $request): JsonResponse
    {
        $data = $request->validated();
        $page = $this->action->create($data);

        return $this->successResponse(
            'Halaman statis berhasil dibuat.',
            new StaticPageResource($page),
            201
        );
    }

    public function show(int $id): JsonResponse
    {
        $page = $this->action->findById($id);

        if (!$page) {
            return $this->errorResponse('Halaman statis tidak ditemukan.', 404);
        }

        return $this->successResponse(
            'Detail halaman statis berhasil dimuat.',
            new StaticPageResource($page)
        );
    }

    public function update(int $id, UpdateStaticPageRequest $request): JsonResponse
    {
        $page = $this->action->findById($id);

        if (!$page) {
            return $this->errorResponse('Halaman statis tidak ditemukan.', 404);
        }

        $data = $request->validated();
        $updatedPage = $this->action->update($id, $data);

        return $this->successResponse(
            'Halaman statis berhasil diperbarui.',
            new StaticPageResource($updatedPage)
        );
    }

    public function destroy(int $id): JsonResponse
    {
        $page = $this->action->findById($id);

        if (!$page) {
            return $this->errorResponse('Halaman statis tidak ditemukan.', 404);
        }

        $this->action->delete($id);

        return $this->successResponse('Halaman statis berhasil dihapus.');
    }
}
