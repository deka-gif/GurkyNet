<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProfileResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $this->resource->loadMissing('wallet');

        $avatar = $this->avatarUrl();
        $role = $this->role instanceof \App\Enums\UserRole ? $this->role->value : $this->role;
        $hasPin = $this->hasPin();
        $kycPayload = app(\App\Services\Kyc\KycService::class)->statusPayload($this->resource);

        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone_number,
            'phone_number' => $this->phone_number,
            'birthDate' => $this->birth_date,
            'gender' => $this->gender,
            'address' => $this->address,
            'avatar' => $avatar,
            'avatar_url' => $avatar,
            'role' => $role,
            'status' => $this->deleted_at ? 'inactive' : 'active',
            'isVerified' => (bool) $this->email_verified_at,
            'hasPin' => $hasPin,
            'has_pin' => $hasPin,
            'pinUpdatedAt' => $this->pin_updated_at?->toIso8601String(),
            'pin_updated_at' => $this->pin_updated_at?->toIso8601String(),
            'notifyTransactions' => (bool) ($this->notify_transactions ?? true),
            'notify_transactions' => (bool) ($this->notify_transactions ?? true),
            'wallet' => $this->wallet ? [
                'id' => $this->wallet->id,
                'walletNo' => $this->wallet->wallet_number,
                'wallet_number' => $this->wallet->wallet_number,
                'balance' => (float) $this->wallet->balance,
                'status' => $this->wallet->status,
                'lastUpdated' => $this->wallet->updated_at?->toIso8601String(),
            ] : null,
            'createdAt' => $this->created_at?->toIso8601String(),
            'user' => [
                'id' => $this->id,
                'name' => $this->name,
                'email' => $this->email,
                'phone' => $this->phone_number,
                'avatar' => $avatar,
                'role' => $role,
                'isVerified' => (bool) $this->email_verified_at,
                'hasPin' => $hasPin,
                'createdAt' => $this->created_at?->toIso8601String(),
            ],
            // FR-KYC-01/02 — derived from Tier 1 columns + latest Tier 2 record (no NIK/docs).
            'kycStatus' => $kycPayload['kycStatus'],
            'kyc' => $kycPayload,
            'phoneVerified' => (bool) $this->phone_verified_at,
            'emailVerified' => (bool) $this->email_verified_at,
            'userType' => $this->user_type,
            'agentLevel' => $this->agent_level,
            'whatsappLinked' => (bool) ($this->whatsapp_linked ?? false),
            'twoFactorEnabled' => (bool) ($this->two_factor_enabled ?? false),
        ];
    }
}

