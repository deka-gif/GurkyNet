<?php

namespace Tests\Unit;

use App\Support\MediaUrl;
use Illuminate\Http\Request;
use Tests\TestCase;

class MediaUrlTest extends TestCase
{
    public function test_disk_relative_path_uses_api_media_delivery_route(): void
    {
        config(['app.url' => 'https://api.example.test']);
        config(['filesystems.cdn_url' => null]);
        config(['filesystems.media_delivery_path' => '/api/v1/public/media']);

        $this->app->instance('request', Request::create('https://api.example.test/api/v1/admin/media', 'GET'));

        $this->assertSame(
            'https://api.example.test/api/v1/public/media/general/uuid.png',
            MediaUrl::absolute('general/uuid.png')
        );
    }

    public function test_legacy_storage_url_is_rebased_to_api_media_route(): void
    {
        config(['app.url' => 'http://127.0.0.1:9000']);
        config(['filesystems.cdn_url' => null]);
        config(['filesystems.media_delivery_path' => '/api/v1/public/media']);

        $this->app->instance('request', Request::create('https://gurkynet.my.id/api/v1/public/banners', 'GET'));

        $this->assertSame(
            'https://gurkynet.my.id/api/v1/public/media/general/uuid.png',
            MediaUrl::absolute('http://127.0.0.1:9000/storage/general/uuid.png')
        );
    }

    public function test_cdn_url_wins_when_configured(): void
    {
        config(['app.url' => 'https://api.example.test']);
        config(['filesystems.cdn_url' => 'https://cdn.example.test']);

        $this->assertSame(
            'https://cdn.example.test/general/uuid.png',
            MediaUrl::absolute('general/uuid.png')
        );
    }

    public function test_to_disk_relative_path_normalizes_variants(): void
    {
        config(['filesystems.media_delivery_path' => '/api/v1/public/media']);

        $this->assertSame('general/a.png', MediaUrl::toDiskRelativePath('general/a.png'));
        $this->assertSame('general/a.png', MediaUrl::toDiskRelativePath('/storage/general/a.png'));
        $this->assertSame(
            'general/a.png',
            MediaUrl::toDiskRelativePath('https://host.example/storage/general/a.png')
        );
        $this->assertSame(
            'general/a.png',
            MediaUrl::toDiskRelativePath('https://host.example/api/v1/public/media/general/a.png')
        );
    }
}
