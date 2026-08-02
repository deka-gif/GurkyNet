<?php

namespace App\Http\Requests\Admin\Operations;

use Illuminate\Foundation\Http\FormRequest;

class UpdateProviderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'status' => 'nullable|boolean',
            'is_active' => 'nullable|boolean',
            'maintenance_flag' => 'nullable|boolean',
            'notes' => 'nullable|string|max:500',
        ];
    }
}
