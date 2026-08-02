<?php

namespace App\Http\Requests\Admin\Marketing;

use Illuminate\Foundation\Http\FormRequest;

class UpdateBannerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => 'nullable|string|max:255',
            'image_url' => 'nullable|string|max:500',
            'image_media_id' => 'nullable|integer',
            'mobile_image_media_id' => 'nullable|integer',
            'redirect_url' => 'nullable|string|max:500',
            'is_active' => 'nullable|boolean',
        ];
    }
}
