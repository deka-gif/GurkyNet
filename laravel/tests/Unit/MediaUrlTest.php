<?php

namespace Tests\Unit;

use App\Support\MediaUrl;
use Illuminate\Http\Request;
use Tests\TestCase;

class MediaUrlTest extends TestCase
{
    public function test_disk_relative_path_is_prefixed_with_storage_and_app_url(): void
    {
        config(['app.url' => 'https://api.example.test']);
        config(['filesystems.cdn_url' => null]);

        $this->app->instance('request', Request::create('https://api.example.test/api/v1/admin/media', 'GET'));

        $this->assertSame(
            'https://api.example.test/storage/general/uuid.png',
            MediaUrl::absolute('general/uuid.png')
        );
    }

    public function test_legacy_absolute_url_is_rebased_to_current_request_host(): void
    {
        config(['app.url' => 'http://127.0.0.1:9000']);
        config(['filesystems.cdn_url' => null]);

        $this->app->instance('request', Request::create('https://api.gurkynet.my.id/api/v1/admin/media', 'GET'));

        $this->assertSame(
            'https://api.gurkynet.my.id/storage/general/uuid.png',
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
        $this->assertSame('general/a.png', MediaUrl::toDiskRelativePath('general/a.png'));
        $this->assertSame('general/a.png', MediaUrl::toDiskRelativePath('/storage/general/a.png'));
        $this->assertSame(
            'general/a.png',
            MediaUrl::toDiskRelativePath('https://host.example/storage/general/a.png')
        );
    }
}
