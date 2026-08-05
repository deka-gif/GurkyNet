<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PublicMediaServeTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_media_route_streams_nested_folder_file(): void
    {
        Storage::fake('public');
        Storage::disk('public')->put(
            'general/0447992f-023d-4bf8-88d8-4e09c9e6aa37.png',
            'fake-png-bytes'
        );

        $response = $this->get('/api/v1/public/media/general/0447992f-023d-4bf8-88d8-4e09c9e6aa37.png');

        $response->assertOk();
        $this->assertStringNotContainsString('text/html', (string) $response->headers->get('Content-Type'));
    }

    public function test_public_media_route_rejects_path_traversal(): void
    {
        Storage::fake('public');

        $this->get('/api/v1/public/media/../.env')->assertNotFound();
    }

    public function test_public_media_route_returns_404_for_missing_file(): void
    {
        Storage::fake('public');

        $this->get('/api/v1/public/media/general/does-not-exist.png')->assertNotFound();
    }
}
