<?php

namespace Tests\Feature;

use App\Http\Resources\BannerResource;
use App\Models\BannerPromotion;
use App\Models\Media;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PublicMediaServeTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_media_route_streams_file_bytes(): void
    {
        Storage::fake('public');
        Storage::disk('public')->put('general/test-banner.png', 'fake-png-bytes');

        $this->assertTrue(Storage::disk('public')->exists('general/test-banner.png'));

        $response = $this->get('/api/v1/public/media/general/test-banner.png');

        $response->assertOk();
        $this->assertStringNotContainsString('text/html', (string) $response->headers->get('Content-Type'));
    }

    public function test_public_media_route_rejects_path_traversal(): void
    {
        Storage::fake('public');

        $this->get('/api/v1/public/media/../.env')->assertNotFound();
    }

    public function test_banner_resource_exposes_absolute_api_media_urls(): void
    {
        config(['filesystems.cdn_url' => null]);
        config(['filesystems.media_delivery_path' => '/api/v1/public/media']);
        config(['app.url' => 'https://gurkynet.my.id']);

        $media = Media::create([
            'filename' => 'banner.png',
            'original_name' => 'banner.png',
            'mime_type' => 'image/png',
            'extension' => 'png',
            'size' => 123,
            'folder' => 'general',
            'storage_disk' => 'public',
            'url' => 'general/banner.png',
            'uploaded_by' => 'test',
        ]);

        $banner = BannerPromotion::create([
            'type' => 'banner',
            'title' => 'Test Banner',
            'description' => 'Desc',
            'image_url' => 'general/banner.png',
            'image_media_id' => $media->id,
            'is_active' => true,
        ]);

        $banner->load('imageMedia');

        $request = Request::create('https://gurkynet.my.id/api/v1/public/banners', 'GET');
        $this->app->instance('request', $request);

        $payload = (new BannerResource($banner))->toArray($request);

        $this->assertSame(
            'https://gurkynet.my.id/api/v1/public/media/general/banner.png',
            $payload['image_url']
        );
        $this->assertSame($payload['image_url'], $payload['thumbnail_url']);
        $this->assertSame($payload['image_url'], $payload['image']);
        $this->assertStringNotContainsString('/storage/storage/', $payload['image_url']);
    }
}
