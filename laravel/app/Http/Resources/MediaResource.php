<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MediaResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'filename' => $this->filename,
            'originalName' => $this->original_name,
            'mimeType' => $this->mime_type,
            'extension' => $this->extension,
            'size' => (int) $this->size,
            'width' => $this->width ? (int) $this->width : null,
            'height' => $this->height ? (int) $this->height : null,
            'altText' => $this->alt_text,
            'folder' => $this->folder,
            'storageDisk' => $this->storage_disk,
            // Always resolve from the RAW DB value so legacy absolute URLs are rebased
            // onto the current API host / CDN (never trust a baked-in APP_URL).
            'url' => \App\Support\MediaUrl::absolute(
                $this->resource->getRawOriginal('url'),
                $this->storage_disk ?: 'public'
            ),
            'cdnUrl' => \App\Support\MediaUrl::absolute(
                $this->resource->getRawOriginal('url'),
                $this->storage_disk ?: 'public'
            ),
            'path' => \App\Support\MediaUrl::toDiskRelativePath((string) $this->resource->getRawOriginal('url')),
            'uploadedBy' => $this->uploaded_by,
            'createdAt' => $this->created_at?->toIso8601String(),
        ];
    }
}
