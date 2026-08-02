<?php

namespace App\Http\Requests\Admin\Website;

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
            'slug' => 'required|string|max:255|unique:homepage_sections,slug',
            'component_type' => 'required|string|in:hero,banner,promo,categories,product_grid,announcement,news,faq,footer',
            'display_order' => 'nullable|integer',
            'visible' => 'nullable|boolean',
            'status' => 'nullable|string|max:50',
            'description' => 'nullable|string',
        ];
    }
}
