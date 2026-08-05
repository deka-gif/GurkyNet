<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Media extends Model
{
    use HasFactory;

    protected $table = 'media';

    protected $fillable = [
        'filename',
        'original_name',
        'mime_type',
        'extension',
        'size',
        'width',
        'height',
        'alt_text',
        'folder',
        'storage_disk',
        'url',
        'uploaded_by',
    ];

    protected $casts = [
        'size' => 'integer',
        'width' => 'integer',
        'height' => 'integer',
    ];

    /**
     * Always expose an absolute, CDN-ready URL to all API clients.
     * Raw DB value remains disk-relative (or legacy absolute); resolution happens here.
     */
    public function getUrlAttribute(?string $value): ?string
    {
        $raw = $value;
        // When accessed as $model->url, Laravel passes the attributes value.
        // Prefer raw original to avoid nested accessor surprises during serialization.
        if ($this->exists && array_key_exists('url', $this->attributes)) {
            $raw = $this->attributes['url'];
        }

        return \App\Support\MediaUrl::absolute($raw, $this->storage_disk ?: 'public');
    }

    /**
     * Disk-relative path for storage operations (delete, exists checks).
     */
    public function diskPath(): string
    {
        $raw = (string) ($this->attributes['url'] ?? ($this->folder . '/' . $this->filename));

        return \App\Support\MediaUrl::toDiskRelativePath($raw);
    }
}
