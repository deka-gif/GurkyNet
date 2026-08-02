<?php

namespace App\Http\Controllers\Api\v1\Admin;

use App\Http\Controllers\Controller;
use App\Traits\ApiResponseTrait;
use App\Actions\Admin\Website\WebsiteSettingAction;
use App\Http\Requests\Admin\Website\CreateWebsiteSettingRequest;
use App\Http\Requests\Admin\Website\UpdateWebsiteSettingRequest;
use App\Http\Resources\WebsiteSettingResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WebsiteSettingController extends Controller
{
    use ApiResponseTrait;

    public function __construct(
        protected WebsiteSettingAction $action
    ) {}

    public function index(): JsonResponse
    {
        $settings = $this->action->list();
        return $this->successResponse(
            'Pengaturan website berhasil dimuat.',
            WebsiteSettingResource::collection($settings)
        );
    }

    public function store(CreateWebsiteSettingRequest $request): JsonResponse
    {
        $data = $request->validated();
        $setting = $this->action->create($data);

        return $this->successResponse(
            'Pengaturan website berhasil dibuat.',
            new WebsiteSettingResource($setting),
            201
        );
    }

    public function show(int $id): JsonResponse
    {
        $setting = $this->action->findById($id);

        if (!$setting) {
            return $this->errorResponse('Pengaturan website tidak ditemukan.', 404);
        }

        return $this->successResponse(
            'Detail pengaturan website berhasil dimuat.',
            new WebsiteSettingResource($setting)
        );
    }

    public function update(int $id, UpdateWebsiteSettingRequest $request): JsonResponse
    {
        $setting = $this->action->findById($id);

        if (!$setting) {
            return $this->errorResponse('Pengaturan website tidak ditemukan.', 404);
        }

        $data = $request->validated();
        $updatedSetting = $this->action->update($id, $data);

        return $this->successResponse(
            'Pengaturan website berhasil diperbarui.',
            new WebsiteSettingResource($updatedSetting)
        );
    }

    public function destroy(int $id): JsonResponse
    {
        $setting = $this->action->findById($id);

        if (!$setting) {
            return $this->errorResponse('Pengaturan website tidak ditemukan.', 404);
        }

        $this->action->delete($id);

        return $this->successResponse('Pengaturan website berhasil dihapus.');
    }
}
