<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ApkVersion extends Model
{
    use HasFactory;

    protected $fillable = [
        'platform',
        'version_code',
        'version_name',
        'min_supported_version_code',
        'download_url',
        'is_force_update',
        'is_active',
        'release_notes',
    ];

    protected $casts = [
        'version_code' => 'integer',
        'min_supported_version_code' => 'integer',
        'is_force_update' => 'boolean',
        'is_active' => 'boolean',
    ];
}
