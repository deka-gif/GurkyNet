<?php

namespace App\Http\Requests\Admin\Operations;

use Illuminate\Foundation\Http\FormRequest;

class UpdateProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        // FE may send selling_price / camelCase
        if ($this->has('selling_price') && !$this->has('sell_price')) {
            $this->merge(['sell_price' => $this->input('selling_price')]);
        }
        if ($this->has('sellingPrice') && !$this->has('sell_price')) {
            $this->merge(['sell_price' => $this->input('sellingPrice')]);
        }
        if ($this->has('basePrice') && !$this->has('base_price')) {
            $this->merge(['base_price' => $this->input('basePrice')]);
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
            'name' => 'nullable|string|max:255',
            'base_price' => 'nullable|numeric|min:0',
            'sell_price' => 'nullable|numeric|min:0',
            'margin' => 'nullable|numeric|min:0',
            'admin_fee' => 'nullable|numeric|min:0',
            // active | inactive | maintenance | boolean
            'status' => 'nullable',
            'admin_notes' => 'nullable|string|max:500',
            'description' => 'nullable|string|max:2000',
        ];
    }
}
