<?php

namespace App\Http\Requests\Admin\Website;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Sparse PATCH/PUT for website settings — only validate fields present in the request.
 * Prevents "logo must be a string" when logo Media objects are not being changed.
 */
class UpdateWebsiteSettingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $normalize = function ($value) {
            if (is_array($value)) {
                // Media resource object accidentally posted — extract URL string
                return $value['url'] ?? $value['file_url'] ?? null;
            }

            return $value;
        };

        $payload = [];
        foreach (['logo', 'logo_dark', 'favicon'] as $key) {
            if ($this->exists($key)) {
                $payload[$key] = $normalize($this->input($key));
            }
        }

        if ($payload !== []) {
            $this->merge($payload);
        }
    }

    public function rules(): array
    {
        $all = [
            'website_name' => 'sometimes|required|string|max:255',
            'tagline' => 'sometimes|nullable|string|max:255',
            'logo' => 'sometimes|nullable|string|max:500',
            'logo_dark' => 'sometimes|nullable|string|max:500',
            'favicon' => 'sometimes|nullable|string|max:500',
            'apk_url' => 'sometimes|nullable|string|max:500',
            'logo_media_id' => 'sometimes|nullable|integer|exists:media,id',
            'logo_dark_media_id' => 'sometimes|nullable|integer|exists:media,id',
            'favicon_media_id' => 'sometimes|nullable|integer|exists:media,id',
            'support_email' => 'sometimes|nullable|email|max:255',
            'support_phone' => 'sometimes|nullable|string|max:50',
            'whatsapp' => 'sometimes|nullable|string|max:50',
            'office_address' => 'sometimes|nullable|string',
            'operating_hours' => 'sometimes|nullable|string|max:255', // FR-MKT01
            'google_maps_url' => 'sometimes|nullable|string|max:1000',
            'facebook' => 'sometimes|nullable|string|max:255',
            'instagram' => 'sometimes|nullable|string|max:255',
            'tiktok' => 'sometimes|nullable|string|max:255',
            'youtube' => 'sometimes|nullable|string|max:255',
            'twitter' => 'sometimes|nullable|string|max:255',
            'copyright' => 'sometimes|nullable|string|max:255',
            'maintenance_mode' => 'sometimes|nullable|boolean',
            'timezone' => 'sometimes|nullable|string|max:100',
            'currency' => 'sometimes|nullable|string|max:10',
            'language' => 'sometimes|nullable|string|max:10',
            'seo_title' => 'sometimes|nullable|string|max:255',
            'seo_description' => 'sometimes|nullable|string',
            'seo_keywords' => 'sometimes|nullable|string|max:500',
        ];

        // Only apply rules for keys actually present (true sparse PATCH).
        $present = array_keys($this->all());

        return array_filter(
            $all,
            fn ($rule, $key) => in_array($key, $present, true),
            ARRAY_FILTER_USE_BOTH
        );
    }
}
