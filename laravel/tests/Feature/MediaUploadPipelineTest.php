<?php

namespace Tests\Feature;

use App\Models\Media;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MediaUploadPipelineTest extends TestCase
{
    use RefreshDatabase;

    public function test_successful_upload_creates_file_and_db_row(): void
    {
        Storage::fake('public');
        Sanctum::actingAs(User::factory()->marketing()->create());

        $response = $this->postJson('/api/v1/admin/media', [
            'file' => UploadedFile::fake()->image('banner.png', 100, 40),
            'folder' => 'general',
            'alt_text' => 'test',
        ]);

        $response->assertCreated();
        $this->assertDatabaseCount('media', 1);

        $media = Media::latest('id')->first();
        $this->assertNotNull($media);
        Storage::disk('public')->assertExists($media->getRawOriginal('url'));
    }

    public function test_failed_upload_creates_no_db_row(): void
    {
        Sanctum::actingAs(User::factory()->marketing()->create());

        $disk = \Mockery::mock();
        $disk->shouldReceive('path')->andReturnUsing(function ($path = '') {
            return sys_get_temp_dir() . DIRECTORY_SEPARATOR . str_replace(['/', '\\'], DIRECTORY_SEPARATOR, (string) $path);
        });
        $disk->shouldReceive('putFileAs')->once()->andThrow(
            new \League\Flysystem\UnableToWriteFile('simulated write failure')
        );
        $disk->shouldReceive('exists')->andReturn(false);
        $disk->shouldReceive('delete')->andReturn(true);

        Storage::shouldReceive('disk')->with('public')->andReturn($disk);

        $before = Media::count();

        $response = $this->postJson('/api/v1/admin/media', [
            'file' => UploadedFile::fake()->image('banner.png', 100, 40),
            'folder' => 'general',
        ]);

        $response->assertStatus(500);
        $this->assertSame($before, Media::count());
    }
}
