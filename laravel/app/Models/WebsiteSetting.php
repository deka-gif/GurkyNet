<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class WebsiteSetting extends Model
{
    use HasFactory;

    protected $fillable = [
        'website_name',
        'tagline',
        'logo',
        'logo_dark',
        'favicon',
        'logo_media_id',
        'logo_dark_media_id',
        'favicon_media_id',
        'support_email',
        'support_phone',
        'whatsapp',
        'office_address',
        'google_maps_url',
        'facebook',
        'instagram',
        'tiktok',
        'youtube',
        'twitter',
        'copyright',
        'maintenance_mode',
        'timezone',
        'currency',
        'language',
        'seo_title',
        'seo_description',
        'seo_keywords',
    ];

    protected $casts = [
        'maintenance_mode' => 'boolean',
        'logo_media_id' => 'integer',
        'logo_dark_media_id' => 'integer',
        'favicon_media_id' => 'integer',
    ];

    public function logoMedia()
    {
        return $this->belongsTo(Media::class, 'logo_media_id');
    }

    public function logoDarkMedia()
    {
        return $this->belongsTo(Media::class, 'logo_dark_media_id');
    }

    public function faviconMedia()
    {
        return $this->belongsTo(Media::class, 'favicon_media_id');
    }
}
