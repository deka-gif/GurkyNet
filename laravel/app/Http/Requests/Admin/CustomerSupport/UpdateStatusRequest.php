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
        return [
            'status' => 'required|string|in:Open,Pending,Resolved,Closed,Terbuka,Selesai,Tertutup,open,pending,resolved,closed',
        ];
    }
}
