<?php

namespace App\Http\Requests\Admin\Website;

use Illuminate\Foundation\Http\FormRequest;

class UpdateWebsiteMenuRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $id = $this->route('id');

        return [
            'title' => 'sometimes|required|string|max:255',
            'slug' => 'nullable|string|max:255',
            'url' => 'sometimes|required|string|max:500',
            'icon' => 'nullable|string|max:100',
            'parent_id' => 'nullable|integer|exists:website_menus,id|different:id',
            'display_order' => 'nullable|integer',
            'visible' => 'nullable|boolean',
            'open_in_new_tab' => 'nullable|boolean',
        ];
    }
}
