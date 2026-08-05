<?php

namespace App\Http\Requests\Admin\Operations;

use Illuminate\Foundation\Http\FormRequest;

class ProductFilterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'search' => 'nullable|string',
            'product_category_id' => 'nullable|integer|exists:product_categories,id',
            'provider_id' => 'nullable|integer|exists:providers,id',
            // Product Provider (Digiflazz / VIP…) — never payment gateways
            'product_provider_id' => 'nullable|integer|exists:product_providers,id',
            'product_provider_code' => 'nullable|string|max:50',
            // Legacy Product Management UI sent `provider=Midtrans` etc.
            'provider' => 'nullable|string|max:100',
            'status' => 'nullable|string',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:100',
        ];
    }
}
