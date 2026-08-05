<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProfileResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone_number,
            'phone_number' => $this->phone_number,
            'birthDate' => $this->birth_date,
            'gender' => $this->gender,
            'address' => $this->address,
            'avatar' => $this->avatar_url ?? null,
            'role' => $this->role instanceof \App\Enums\UserRole ? $this->role->value : $this->role,
            'isVerified' => (bool) $this->email_verified_at,
            'wallet' => $this->wallet ? [
                'id' => $this->wallet->id,
                'walletNo' => $this->wallet->wallet_number,
                'wallet_number' => $this->wallet->wallet_number,
                'balance' => (float) $this->wallet->balance,
                'points' => (int) ($this->wallet->points ?? 0),
                'currency' => $this->wallet->currency ?? 'IDR',
                'status' => $this->wallet->status,
                'lastUpdated' => $this->wallet->updated_at?->toIso8601String(),
            ] : null,
            'createdAt' => $this->created_at?->toIso8601String(),
            
            // Profile interface support:
            'user' => [
                'id' => $this->id,
                'name' => $this->name,
                'email' => $this->email,
                'phone' => $this->phone_number,
                'avatar' => $this->avatar_url ?? null,
                'role' => $this->role instanceof \App\Enums\UserRole ? $this->role->value : $this->role,
                'isVerified' => (bool) $this->email_verified_at,
                'createdAt' => $this->created_at?->toIso8601String(),
            ],
            'kycStatus' => $this->kyc_status ?? 'unverified',
            'whatsappLinked' => (bool) ($this->whatsapp_linked ?? false),
            'twoFactorEnabled' => (bool) ($this->two_factor_enabled ?? false),
        ];
    }
}
