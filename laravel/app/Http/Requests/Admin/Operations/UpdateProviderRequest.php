<?php

namespace App\Http\Requests\Admin\Operations;

use Illuminate\Foundation\Http\FormRequest;

class UpdateProviderRequest extends FormRequest
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
        if ($this->has('partner_status') && is_string($this->input('partner_status'))) {
            $this->merge(['partner_status' => strtolower(trim((string) $this->input('partner_status')))]);
        }
    }

    public function rules(): array
    {
        return [
            'name' => 'nullable|string|max:255',
            'status' => 'nullable',
            'partner_status' => 'nullable|string|max:32',
            'is_active' => 'nullable|boolean',
            'maintenance_flag' => 'nullable|boolean',
            'notes' => 'nullable|string|max:500',
        ];
    }
}
