<?php

namespace App\Http\Controllers\Api\v1\Admin;

use App\Http\Controllers\Controller;
use App\Traits\ApiResponseTrait;
use App\Actions\Admin\Website\WebsiteMenuAction;
use App\Http\Requests\Admin\Website\CreateWebsiteMenuRequest;
use App\Http\Requests\Admin\Website\UpdateWebsiteMenuRequest;
use App\Http\Resources\WebsiteMenuResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WebsiteMenuController extends Controller
{
    use ApiResponseTrait;

    public function __construct(
        protected WebsiteMenuAction $action
    ) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->only(['visible', 'parent_only', 'keyword', 'per_page']);
        $paginator = $this->action->listPaginated($filters);

        return $this->paginatedResponse(
            'Daftar menu website berhasil dimuat.',
            WebsiteMenuResource::collection($paginator->items()),
            $paginator
        );
    }

    public function store(CreateWebsiteMenuRequest $request): JsonResponse
    {
        $data = $request->validated();
        $menu = $this->action->create($data);

        // Load relations if requested or needed
        $menu->load(['parent', 'children']);

        return $this->successResponse(
            'Menu website berhasil dibuat.',
            new WebsiteMenuResource($menu),
            201
        );
    }

    public function show(int $id): JsonResponse
    {
        $menu = $this->action->findById($id);

        if (!$menu) {
            return $this->errorResponse('Menu website tidak ditemukan.', 404);
        }

        return $this->successResponse(
            'Detail menu website berhasil dimuat.',
            new WebsiteMenuResource($menu)
        );
    }

    public function update(int $id, UpdateWebsiteMenuRequest $request): JsonResponse
    {
        $menu = $this->action->findById($id);

        if (!$menu) {
            return $this->errorResponse('Menu website tidak ditemukan.', 404);
        }

        $data = $request->validated();
        $updatedMenu = $this->action->update($id, $data);

        $updatedMenu->load(['parent', 'children']);

        return $this->successResponse(
            'Menu website berhasil diperbarui.',
            new WebsiteMenuResource($updatedMenu)
        );
    }

    public function destroy(int $id): JsonResponse
    {
        $menu = $this->action->findById($id);

        if (!$menu) {
            return $this->errorResponse('Menu website tidak ditemukan.', 404);
        }

        $this->action->delete($id);

        return $this->successResponse('Menu website berhasil dihapus.');
    }
}
