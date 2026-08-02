<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class HomepageSection extends Model
{
    use HasFactory;

    protected $fillable = [
        'title',
        'slug',
        'component_type',
        'display_order',
        'visible',
        'status',
        'description',
        'hero_background_media_id',
        'hero_illustration_media_id',
        'hero_mobile_image_media_id',
    ];

    protected $casts = [
        'visible' => 'boolean',
        'display_order' => 'integer',
        'hero_background_media_id' => 'integer',
        'hero_illustration_media_id' => 'integer',
        'hero_mobile_image_media_id' => 'integer',
    ];

    public function heroBackgroundMedia()
    {
        return $this->belongsTo(Media::class, 'hero_background_media_id');
    }

    public function heroIllustrationMedia()
    {
        return $this->belongsTo(Media::class, 'hero_illustration_media_id');
    }

    public function heroMobileImageMedia()
    {
        return $this->belongsTo(Media::class, 'hero_mobile_image_media_id');
    }
}
