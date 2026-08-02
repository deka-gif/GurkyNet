<?php

namespace App\Http\Requests\Admin\Marketing;

use Illuminate\Foundation\Http\FormRequest;

class CreateAnnouncementRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => 'required|string|max:255',
            'message' => 'required|string',
            'type' => 'nullable|string|in:announcement,broadcast,system',
            'cover_media_id' => 'nullable|integer',
            'is_active' => 'nullable|boolean',
        ];
    }
}
