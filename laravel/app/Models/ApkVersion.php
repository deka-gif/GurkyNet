<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ApkVersion extends Model
{
    use HasFactory;

    protected $fillable = [
        'version_code',
        'version_name',
        'download_url',
        'is_force_update',
        'release_notes',
    ];

    protected $casts = [
        'version_code' => 'integer',
        'is_force_update' => 'boolean',
    ];
}
