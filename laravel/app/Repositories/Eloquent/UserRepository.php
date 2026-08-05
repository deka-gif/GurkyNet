<?php

namespace App\Repositories\Eloquent;

use App\Models\User;
use App\Repositories\Contracts\UserRepositoryInterface;
use Illuminate\Support\Facades\Hash;

class UserRepository implements UserRepositoryInterface
{
    public function create(array $data): User
    {
        return User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'phone_number' => $data['phone_number'],
            'password' => Hash::make($data['password']),
            'role' => $data['role'] ?? \App\Enums\UserRole::USER,
        ]);
    }

    public function findByPhone(string $phone): ?User
    {
        return User::where('phone_number', $phone)->first();
    }

    public function findByEmail(string $email): ?User
    {
        return User::where('email', $email)->first();
    }

    public function findById(int $id): ?User
    {
        return User::find($id);
    }

    public function update(User $user, array $data): bool
    {
        // Prevent privilege escalation via mass assignment.
        unset($data['role'], $data['id'], $data['email_verified_at']);

        if (isset($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        }
        return $user->update($data);
    }

    public function updatePin(User $user, string $pin): bool
    {
        return $user->update([
            'transaction_pin' => Hash::make($pin),
        ]);
    }
}
