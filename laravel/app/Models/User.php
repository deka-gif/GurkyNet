<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    protected $fillable = [
        'name',
        'email',
        'password',
        'phone_number',
        'birth_date',
        'gender',
        'address',
        'avatar_path',
        'role',
        'transaction_pin',
        'pin_updated_at',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'transaction_pin',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
        'transaction_pin' => 'hashed',
        'pin_updated_at' => 'datetime',
        'role' => \App\Enums\UserRole::class,
    ];

    /**
     * Whether the user has a transaction PIN configured.
     */
    public function hasPin(): bool
    {
        return $this->transaction_pin !== null && $this->transaction_pin !== '';
    }

    /**
     * Public avatar URL from Laravel Storage (or null).
     */
    public function avatarUrl(): ?string
    {
        if (!$this->avatar_path) {
            return null;
        }

        return \Illuminate\Support\Facades\Storage::disk('public')->url($this->avatar_path);
    }

    protected static function booted(): void
    {
        static::creating(function (User $user) {
            if (empty($user->role)) {
                $user->role = \App\Enums\UserRole::USER;
            }
        });
    }
    /**
     * Check if user has any of the given roles.
     */
    public function hasRole(string|\App\Enums\UserRole ...$roles): bool
    {
        $userRoleValue = $this->role instanceof \App\Enums\UserRole ? $this->role->value : (string) $this->role;

        foreach ($roles as $role) {
            $checkValue = $role instanceof \App\Enums\UserRole ? $role->value : $role;
            if ($userRoleValue === $checkValue) {
                return true;
            }
        }
        return false;
    }

    public function isSuperAdmin(): bool
    {
        return $this->hasRole(\App\Enums\UserRole::SUPER_ADMIN);
    }

    public function isOwner(): bool
    {
        return $this->hasRole(\App\Enums\UserRole::OWNER);
    }

    public function isFinance(): bool
    {
        return $this->hasRole(\App\Enums\UserRole::FINANCE);
    }

    public function isOperations(): bool
    {
        return $this->hasRole(\App\Enums\UserRole::OPERATIONS);
    }

    public function isMarketing(): bool
    {
        return $this->hasRole(\App\Enums\UserRole::MARKETING);
    }

    public function isCustomerSupport(): bool
    {
        return $this->hasRole(\App\Enums\UserRole::CUSTOMER_SUPPORT);
    }

    public function isUser(): bool
    {
        return $this->hasRole(\App\Enums\UserRole::USER);
    }

    /**
     * Relationship: One User has One Wallet.
     */
    public function wallet(): HasOne
    {
        return $this->hasOne(Wallet::class);
    }

    /**
     * Relationship: One User has Many Transactions.
     */
    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class);
    }

    /**
     * Relationship: One User has Many Support Tickets.
     */
    public function supportTickets(): HasMany
    {
        return $this->hasMany(SupportTicket::class);
    }

    /**
     * Relationship: One User has Many LoginLogs.
     */
    public function loginLogs(): HasMany
    {
        return $this->hasMany(LoginLog::class);
    }

    /**
     * Relationship: One User has Many ActivityLogs.
     */
    public function activityLogs(): HasMany
    {
        return $this->hasMany(ActivityLog::class);
    }

    /**
     * Relationship: One User has Many Personal/Pivot Notifications.
     */
    public function userNotifications(): HasMany
    {
        return $this->hasMany(UserNotification::class);
    }
}
