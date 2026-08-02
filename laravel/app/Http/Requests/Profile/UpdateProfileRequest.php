<?php

namespace App\Http\Requests\Profile;

use Illuminate\Foundation\Http\FormRequest;

class UpdateProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $userId = $this->user()?->id;

        return [
            'name' => 'required|string|max:255',
            'phone_number' => 'required|string|unique:users,phone_number,' . $userId,
            'email' => 'required|email|unique:users,email,' . $userId,
            'birth_date' => 'nullable|date_format:Y-m-d',
            'gender' => 'nullable|string|in:Laki-laki,Perempuan,Male,Female',
            'address' => 'nullable|string',
        ];
    }
}
