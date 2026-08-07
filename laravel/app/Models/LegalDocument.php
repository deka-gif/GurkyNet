<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LegalDocument extends Model
{
    public const TYPE_PRIVACY = 'privacy_policy';

    public const TYPE_TERMS = 'terms_conditions';

    public const TYPE_REFUND = 'refund_policy';

    protected $fillable = [
        'type',
        'slug',
        'title',
        'content',
        'draft_content',
        'is_dirty',
        'seo_title',
        'seo_description',
        'seo_keywords',
        'canonical_url',
        'og_image',
        'status',
        'estimated_reading_minutes',
        'version_number',
        'created_by',
        'updated_by',
        'published_at',
    ];

    protected $casts = [
        'is_dirty' => 'boolean',
        'published_at' => 'datetime',
        'estimated_reading_minutes' => 'integer',
        'version_number' => 'integer',
    ];

    public function versions(): HasMany
    {
        return $this->hasMany(LegalDocumentVersion::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function isPublished(): bool
    {
        return $this->status === 'published' && filled($this->content);
    }

    /**
     * @return list<array{type:string,slug:string,title:string,icon:string}>
     */
    public static function catalog(): array
    {
        return [
            [
                'type' => self::TYPE_PRIVACY,
                'slug' => 'privacy-policy',
                'title' => 'Privacy Policy',
                'icon' => 'shield',
            ],
            [
                'type' => self::TYPE_TERMS,
                'slug' => 'terms-conditions',
                'title' => 'Terms & Conditions',
                'icon' => 'file-text',
            ],
            [
                'type' => self::TYPE_REFUND,
                'slug' => 'refund-policy',
                'title' => 'Refund Policy',
                'icon' => 'rotate-ccw',
            ],
        ];
    }
}
