<?php

namespace App\Http\Requests\Admin\Operations;

use Illuminate\Foundation\Http\FormRequest;

class UpdatePricingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('selling_price') && ! $this->has('sell_price')) {
            $this->merge(['sell_price' => $this->input('selling_price')]);
        }
        if ($this->has('sellingPrice') && ! $this->has('sell_price')) {
            $this->merge(['sell_price' => $this->input('sellingPrice')]);
        }
        if ($this->route('id') && ! $this->has('product_id') && ! $this->has('id')) {
            $this->merge(['product_id' => $this->route('id')]);
        }

        if ($this->has('status') && is_string($this->input('status'))) {
            $normalized = strtolower(trim((string) $this->input('status')));
            $map = [
                'active' => 'active',
                'tersedia' => 'active',
                '1' => 'active',
                'true' => 'active',
                'inactive' => 'inactive',
                'nonaktif' => 'inactive',
                '0' => 'inactive',
                'false' => 'inactive',
                'gangguan' => 'inactive',
                'maintenance' => 'maintenance',
            ];
            $this->merge([
                'status' => $map[$normalized] ?? $normalized,
            ]);
        }
    }

    public function rules(): array
    {
        return [
            // Per-SKU Pricing Engine (writes products.sell_price / ops_status)
            'product_id' => 'nullable|integer|exists:products,id',
            'id' => 'nullable|integer|exists:products,id',
            'sell_price' => 'nullable|numeric|min:0',
            'selling_price' => 'nullable|numeric|min:0',
            'margin' => 'nullable|numeric|min:0',
            'status' => 'nullable|string|max:32',
            'admin_notes' => 'nullable|string|max:500',

            // Legacy global margin rules (settings table — not a pricing catalog)
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
