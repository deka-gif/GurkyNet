<?php

namespace App\Http\Requests\Admin\Operations;

use Illuminate\Foundation\Http\FormRequest;

class ProductFilterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('status') && is_string($this->input('status'))) {
            $this->merge([
                'status' => strtolower(trim((string) $this->input('status'))),
            ]);
        }

        if ($this->has('category') && is_string($this->input('category'))) {
            $this->merge([
                'category' => strtolower(trim((string) $this->input('category'))),
            ]);
        }

        if ($this->has('sort') && is_string($this->input('sort'))) {
            $this->merge([
                'sort' => strtolower(trim((string) $this->input('sort'))),
            ]);
        }
    }

    public function rules(): array
    {
        return [
            'search' => 'nullable|string|max:255',
            // Canonical GurkyNet category slug (pulsa, game, topup-digital, …)
            'category' => 'nullable|string|max:64',
            'product_category_id' => 'nullable|integer|exists:product_categories,id',
            'provider_id' => 'nullable|integer|exists:providers,id',
            // Hierarchical Pricing: operator/brand drill-down
            'brand_id' => 'nullable|integer|exists:providers,id',
            'node_key' => 'nullable|string|max:64',
            'data_group' => 'nullable|string|max:64',
            'view' => 'nullable|string|max:32',
            // Product Provider (Digiflazz / VIP…) — never payment gateways
            'product_provider_id' => 'nullable|integer|exists:product_providers,id',
            'product_provider_code' => 'nullable|string|max:50',
            // Legacy Product Management UI sent `provider=Midtrans` etc.
            'provider' => 'nullable|string|max:100',
            'status' => 'nullable|string|max:32',
            // Phase 20 — products whose category came from the unmapped-fallback default.
            'unmapped' => 'nullable|boolean',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:100',
            'sort' => 'nullable|string|in:newest,oldest,name_asc,name_desc,price_asc,price_desc',
        ];
    }
}
