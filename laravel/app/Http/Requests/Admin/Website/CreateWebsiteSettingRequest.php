<?php

namespace App\Http\Requests\Admin\Website;

use Illuminate\Foundation\Http\FormRequest;

class CreateWebsiteSettingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'website_name' => 'required|string|max:255',
            'tagline' => 'nullable|string|max:255',
            'logo' => 'nullable|string|max:500',
            'logo_dark' => 'nullable|string|max:500',
            'favicon' => 'nullable|string|max:500',
            'apk_url' => 'nullable|string|max:500',
            'logo_media_id' => 'nullable|integer|exists:media,id',
            'logo_dark_media_id' => 'nullable|integer|exists:media,id',
            'favicon_media_id' => 'nullable|integer|exists:media,id',
            'support_email' => 'nullable|email|max:255',
            'support_phone' => 'nullable|string|max:50',
            'whatsapp' => 'nullable|string|max:50',
            'office_address' => 'nullable|string',
            'operating_hours' => 'nullable|string|max:255', // FR-MKT01
            'google_maps_url' => 'nullable|string|max:1000',
            'facebook' => 'nullable|string|max:255',
            'instagram' => 'nullable|string|max:255',
            'tiktok' => 'nullable|string|max:255',
            'youtube' => 'nullable|string|max:255',
            'twitter' => 'nullable|string|max:255',
            'copyright' => 'nullable|string|max:255',
            'maintenance_mode' => 'nullable|boolean',
            'timezone' => 'nullable|string|max:100',
            'currency' => 'nullable|string|max:10',
            'language' => 'nullable|string|max:10',
            'seo_title' => 'nullable|string|max:255',
            'seo_description' => 'nullable|string',
            'seo_keywords' => 'nullable|string|max:500',
        ];
    }
}
