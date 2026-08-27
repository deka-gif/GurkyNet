<?php

namespace App\Http\Requests\Admin\CustomerSupport;

use Illuminate\Foundation\Http\FormRequest;

class UpdateStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        // FR-CS-02 — SRS 7.8 statuses + legacy aliases (normalized in repository).
        return [
            'status' => 'required|string|max:64',
            'assigned_to' => 'nullable|integer|exists:users,id',
        ];
    }
}
