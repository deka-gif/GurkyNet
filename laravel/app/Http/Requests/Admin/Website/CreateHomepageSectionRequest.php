<?php

namespace App\Http\Requests\Admin\Website;

use App\Support\HomepageSectionTypes;
use Illuminate\Foundation\Http\FormRequest;

class CreateHomepageSectionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => 'required|string|max:255',
            'subtitle' => 'nullable|string|max:255',
            'slug' => 'required|string|max:255|unique:homepage_sections,slug',
            'component_type' => 'required|string|'.HomepageSectionTypes::validationRule(),
            'display_order' => 'nullable|integer',
            'visible' => 'nullable|boolean',
            'status' => 'nullable|string|max:50',
            'description' => 'nullable|string',
            'background_color' => 'nullable|string|max:32',
            'text_color' => 'nullable|string|max:32',
            'button_label' => 'nullable|string|max:255',
            'button_url' => 'nullable|string|max:500',
            'animation' => 'nullable|string|in:fade,slide_up,scale,none',
            'content_items' => 'nullable|array',
            'content_items.*.title' => 'nullable|string|max:255',
            'content_items.*.subtitle' => 'nullable|string|max:255',
            'content_items.*.description' => 'nullable|string',
            'content_items.*.value' => 'nullable|string|max:64',
            'content_items.*.icon' => 'nullable|string|max:64',
            'content_items.*.image' => 'nullable|string|max:500',
            'content_items.*.url' => 'nullable|string|max:500',
            'hero_background_media_id' => 'nullable|integer|exists:media,id',
            'hero_illustration_media_id' => 'nullable|integer|exists:media,id',
            'hero_mobile_image_media_id' => 'nullable|integer|exists:media,id',
        ];
    }
}
