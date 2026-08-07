<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

class BannerPromotion extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'type',
        'title',
        'slug',
        'code',
        'description',
        'terms',
        'discount_amount',
        'discount_type',
        'min_transaction',
        'quota',
        'used_count',
        'image_url',
        'image_media_id',
        'mobile_image_media_id',
        'redirect_url',
        'starts_at',
        'ends_at',
        'cta_label',
        'priority',
        'sort_order',
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
        'priority' => 'integer',
        'sort_order' => 'integer',
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::saving(function (BannerPromotion $model) {
            if (blank($model->slug) && filled($model->title)) {
                $model->slug = static::makeUniqueSlug($model->title, $model->id);
            }
        });
    }

    public function imageMedia()
    {
        return $this->belongsTo(Media::class, 'image_media_id');
    }

    public function mobileImageMedia()
    {
        return $this->belongsTo(Media::class, 'mobile_image_media_id');
    }

    /**
     * Schedule lifecycle for CMS + user promo detail.
     * Values: active | upcoming | expired | inactive
     */
    public function resolveScheduleStatus(?Carbon $now = null): string
    {
        if (! $this->is_active) {
            return 'inactive';
        }

        $now = $now ?? now();

        if ($this->starts_at && $this->starts_at->gt($now)) {
            return 'upcoming';
        }

        if ($this->ends_at && $this->ends_at->lt($now)) {
            return 'expired';
        }

        return 'active';
    }

    public function getScheduleStatusAttribute(): string
    {
        return $this->resolveScheduleStatus();
    }

    public function scopeBanners(Builder $query): Builder
    {
        return $query->where('type', 'banner');
    }

    public function scopeOrderedForDisplay(Builder $query): Builder
    {
        return $query
            ->orderBy('sort_order')
            ->orderByDesc('priority')
            ->orderByDesc('id');
    }

    /**
     * Currently running banners for user carousel (active flag + date window).
     */
    public function scopeVisibleInCarousel(Builder $query, ?Carbon $now = null): Builder
    {
        $now = $now ?? now();

        return $query
            ->banners()
            ->where('is_active', true)
            ->where(function (Builder $q) use ($now) {
                $q->whereNull('starts_at')->orWhere('starts_at', '<=', $now);
            })
            ->where(function (Builder $q) use ($now) {
                $q->whereNull('ends_at')->orWhere('ends_at', '>=', $now);
            });
    }

    public static function makeUniqueSlug(string $title, int|string|null $ignoreId = null): string
    {
        $base = Str::slug($title) ?: 'promo';
        $slug = $base;
        $i = 2;

        while (
            static::withTrashed()
                ->where('slug', $slug)
                ->when($ignoreId, fn (Builder $q) => $q->where('id', '!=', $ignoreId))
                ->exists()
        ) {
            $slug = $base.'-'.$i;
            $i++;
        }

        return $slug;
    }
}
