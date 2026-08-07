<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class HomepageSection extends Model
{
    use HasFactory;

    protected $fillable = [
        'title',
        'subtitle',
        'slug',
        'component_type',
        'display_order',
        'visible',
        'status',
        'description',
        'background_color',
        'text_color',
        'button_label',
        'button_url',
        'animation',
        'content_items',
        'config',
        'hero_background_media_id',
        'hero_illustration_media_id',
        'hero_mobile_image_media_id',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'visible' => 'boolean',
        'display_order' => 'integer',
        'content_items' => 'array',
        'config' => 'array',
        'hero_background_media_id' => 'integer',
        'hero_illustration_media_id' => 'integer',
        'hero_mobile_image_media_id' => 'integer',
        'created_by' => 'integer',
        'updated_by' => 'integer',
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

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updater()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
