<?php

namespace App\Http\Requests\Admin\Operations;

use Illuminate\Foundation\Http\FormRequest;

class ProviderFilterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('status') && is_string($this->input('status'))) {
            $this->merge(['status' => strtolower(trim((string) $this->input('status')))]);
        }

        if ($this->has('supported_service') && is_string($this->input('supported_service'))) {
            $this->merge(['supported_service' => strtolower(trim((string) $this->input('supported_service')))]);
        } elseif ($this->has('service') && is_string($this->input('service'))) {
            $this->merge([
                'supported_service' => strtolower(trim((string) $this->input('service'))),
            ]);
        }

        if ($this->has('sort') && is_string($this->input('sort'))) {
            $this->merge(['sort' => strtolower(trim((string) $this->input('sort')))]);
        }
    }

    public function rules(): array
    {
        return [
            'search' => 'nullable|string|max:255',
            'status' => 'nullable|string|max:32',
            'supported_service' => 'nullable|string|max:64',
            'service' => 'nullable|string|max:64',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:100',
            'sort' => 'nullable|string|in:priority,name_asc,name_desc,status,newest',
            'refresh' => 'nullable|boolean',
        ];
    }
}
