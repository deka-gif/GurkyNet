<?php

namespace App\Repositories\Contracts;

use App\Models\User;

interface UserRepositoryInterface
{
    public function create(array $data): User;
    public function findByPhone(string $phone): ?User;
    public function findByEmail(string $email): ?User;
    public function findById(int $id): ?User;
    public function update(User $user, array $data): bool;
    public function updatePin(User $user, string $pin): bool;
}
