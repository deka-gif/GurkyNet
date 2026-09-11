<?php

namespace App\Http\Requests\Admin\CustomerSupport;

use Illuminate\Foundation\Http\FormRequest;

class UpdateKnowledgeBaseFaqRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'answer' => ['required', 'string', 'min:10', 'max:20000'],
            'question' => ['sometimes', 'string', 'min:5', 'max:500'],
        ];
    }
}
