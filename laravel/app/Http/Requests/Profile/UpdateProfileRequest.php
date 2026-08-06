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
            'name' => 'sometimes|required|string|max:255',
            'phone_number' => 'sometimes|required|string|unique:users,phone_number,' . $userId,
            // Email must not be changed directly — use OTP verification flow.
            'birth_date' => 'nullable|date_format:Y-m-d',
            'gender' => 'nullable|string|in:Laki-laki,Perempuan,Male,Female',
            'address' => 'nullable|string',
        ];
    }
}
