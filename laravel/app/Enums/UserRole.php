<?php

namespace App\Enums;

enum UserRole: string
{
    case SUPER_ADMIN = 'super_admin';
    case OWNER = 'owner';
    case FINANCE = 'finance';
    case OPERATIONS = 'operations';
    case MARKETING = 'marketing';
    case CUSTOMER_SUPPORT = 'customer_support';
    case USER = 'user';

    public function label(): string
    {
        return match ($this) {
            self::SUPER_ADMIN => 'Super Admin',
            self::OWNER => 'Owner',
            self::FINANCE => 'Finance',
            self::OPERATIONS => 'Operations',
            self::MARKETING => 'Marketing',
            self::CUSTOMER_SUPPORT => 'Customer Support',
            self::USER => 'Regular User',
        };
    }
}

