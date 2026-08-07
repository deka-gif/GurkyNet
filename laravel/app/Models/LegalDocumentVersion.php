<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LegalDocumentVersion extends Model
{
    protected $fillable = [
        'legal_document_id',
        'version_number',
        'label',
        'title',
        'content',
        'seo_title',
        'seo_description',
        'seo_keywords',
        'source',
        'created_by',
        'published_at',
    ];

    protected $casts = [
        'published_at' => 'datetime',
        'version_number' => 'integer',
    ];

    public function document(): BelongsTo
    {
        return $this->belongsTo(LegalDocument::class, 'legal_document_id');
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
