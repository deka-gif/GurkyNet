<?php

namespace App\Repositories\Eloquent;

use App\Models\WebsiteSetting;
use App\Repositories\Contracts\WebsiteSettingRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;

class WebsiteSettingRepository implements WebsiteSettingRepositoryInterface
{
    public function all(): Collection
    {
        return WebsiteSetting::all();
    }

    public function findById(int $id): ?WebsiteSetting
    {
        return WebsiteSetting::find($id);
    }

    public function getLatest(): ?WebsiteSetting
    {
        return WebsiteSetting::latest('id')->first();
    }

    public function create(array $data): WebsiteSetting
    {
        return WebsiteSetting::create($data);
    }

    public function update(int $id, array $data): WebsiteSetting
    {
        $setting = WebsiteSetting::findOrFail($id);
        $setting->update($data);
        return $setting;
    }

    public function delete(int $id): bool
    {
        $setting = WebsiteSetting::find($id);
        if ($setting) {
            return $setting->delete();
        }
        return false;
    }
}
