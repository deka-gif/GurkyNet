<?php

namespace App\Http\Requests\Admin\Operations;

use Illuminate\Foundation\Http\FormRequest;

class UpdatePricingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'default_margin' => 'nullable|numeric|min:0',
            'category_margin' => 'nullable|array',
            'category_margin.*.category' => 'required_with:category_margin|string',
            'category_margin.*.margin' => 'required_with:category_margin|numeric|min:0',
            'provider_margin' => 'nullable|array',
            'provider_margin.*.provider' => 'required_with:provider_margin|string',
            'provider_margin.*.margin' => 'required_with:provider_margin|numeric|min:0',
        ];
    }
}
