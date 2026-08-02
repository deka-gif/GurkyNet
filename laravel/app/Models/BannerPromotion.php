<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class BannerPromotion extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'type',
        'title',
        'code',
        'description',
        'discount_amount',
        'discount_type',
        'min_transaction',
        'quota',
        'used_count',
        'image_url',
        'image_media_id',
        'mobile_image_media_id',
        'redirect_url',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'discount_amount' => 'float',
        'min_transaction' => 'float',
        'quota' => 'integer',
        'used_count' => 'integer',
        'image_media_id' => 'integer',
        'mobile_image_media_id' => 'integer',
    ];

    public function imageMedia()
    {
        return $this->belongsTo(Media::class, 'image_media_id');
    }

    public function mobileImageMedia()
    {
        return $this->belongsTo(Media::class, 'mobile_image_media_id');
    }
}

