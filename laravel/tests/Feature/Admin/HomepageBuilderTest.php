<?php

namespace Tests\Feature\Admin;

use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\HomepageBuilderDraft;
use App\Models\HomepageBuilderVersion;
use App\Models\HomepageSection;
use App\Models\Setting;
use App\Models\User;
use App\Services\Website\PublicHomepageCache;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class HomepageBuilderTest extends TestCase
{
    use RefreshDatabase;

    protected function actingAsRole(UserRole $role): User
    {
        $user = User::create([
            'name' => $role->label(),
            'email' => $role->value.'-builder@gurkypay.com',
            'phone_number' => '0812'.random_int(10000000, 99999999),
            'password' => Hash::make('password123'),
            'role' => $role,
            'transaction_pin' => Hash::make('123456'),
        ]);
        Sanctum::actingAs($user);

        return $user;
    }

    protected function seedSection(): HomepageSection
    {
        return HomepageSection::create([
            'title' => 'Hero',
            'slug' => 'hero-builder',
            'component_type' => 'hero',
            'display_order' => 1,
            'visible' => true,
            'status' => 'active',
            'description' => 'Hello',
            'animation' => 'fade',
        ]);
    }

    public function test_marketing_can_reorder_save_draft_and_publish(): void
    {
        Cache::flush();
        $hero = $this->seedSection();
        HomepageSection::create([
            'title' => 'FAQ',
            'slug' => 'faq-builder',
            'component_type' => 'faq',
            'display_order' => 2,
            'visible' => true,
            'status' => 'active',
            'description' => 'FAQ',
        ]);

        $this->actingAsRole(UserRole::MARKETING);

        $state = $this->getJson('/api/v1/admin/website/homepage-builder')->assertOk()->json('data');
        $this->assertTrue($state['permissions']['canDraft']);
        $this->assertTrue($state['permissions']['canPublish']);
        $this->assertGreaterThanOrEqual(2, count($state['draft']['sections']));

        $sections = $state['draft']['sections'];
        // Move last to first
        $reordered = array_reverse($sections);
        foreach ($reordered as $i => &$row) {
            $row['displayOrder'] = $i + 1;
        }
        unset($row);

        $this->putJson('/api/v1/admin/website/homepage-builder/draft', ['sections' => $reordered])
            ->assertOk()
            ->assertJsonPath('data.draft.isDirty', true);

        $this->postJson('/api/v1/admin/website/homepage-builder/publish', ['label' => 'Campaign Test'])
            ->assertOk()
            ->assertJsonPath('data.draft.isDirty', false);

        $this->assertDatabaseHas('homepage_builder_versions', ['version_number' => 1]);
        $this->assertDatabaseHas('activity_logs', ['activity' => 'HOMEPAGE_BUILDER_PUBLISHED']);

        // Live order should follow published draft
        $first = HomepageSection::orderBy('display_order')->first();
        $this->assertSame($reordered[0]['slug'], $first->slug);

        $this->assertFalse(Cache::has(PublicHomepageCache::KEY));
    }

    public function test_disable_section_in_draft_hides_after_publish(): void
    {
        $this->seedSection();
        $this->actingAsRole(UserRole::MARKETING);

        $state = $this->getJson('/api/v1/admin/website/homepage-builder')->json('data');
        $sections = $state['draft']['sections'];
        $sections[0]['enabled'] = false;

        $this->putJson('/api/v1/admin/website/homepage-builder/draft', ['sections' => $sections])->assertOk();
        $this->postJson('/api/v1/admin/website/homepage-builder/publish')->assertOk();

        $live = HomepageSection::where('slug', 'hero-builder')->first();
        $this->assertFalse((bool) $live->visible);
        $this->assertSame('draft', $live->status);

        $public = $this->getJson('/api/v1/public/homepage')->assertOk()->json('data.sections');
        $slugs = collect($public)->pluck('slug')->all();
        $this->assertNotContains('hero-builder', $slugs);
    }

    public function test_operations_is_read_only(): void
    {
        $this->seedSection();
        $this->actingAsRole(UserRole::OPERATIONS);

        $this->getJson('/api/v1/admin/website/homepage-builder')
            ->assertOk()
            ->assertJsonPath('data.permissions.canDraft', false)
            ->assertJsonPath('data.permissions.canPublish', false);

        $this->putJson('/api/v1/admin/website/homepage-builder/draft', ['sections' => []])
            ->assertStatus(403);
    }

    public function test_marketing_staff_setting_blocks_publish(): void
    {
        $this->seedSection();
        Setting::updateOrCreate(
            ['key' => 'homepage_builder_marketing_can_publish'],
            ['value' => 'false']
        );

        $this->actingAsRole(UserRole::MARKETING);
        $state = $this->getJson('/api/v1/admin/website/homepage-builder')->json('data');
        $this->assertTrue($state['permissions']['canDraft']);
        $this->assertFalse($state['permissions']['canPublish']);

        $this->postJson('/api/v1/admin/website/homepage-builder/publish')->assertStatus(403);
    }

    public function test_rollback_restores_previous_version(): void
    {
        $this->seedSection();
        $this->actingAsRole(UserRole::OWNER);

        $state = $this->getJson('/api/v1/admin/website/homepage-builder')->json('data');
        $sections = $state['draft']['sections'];
        $sections[0]['title'] = 'Hero V1';
        $this->putJson('/api/v1/admin/website/homepage-builder/draft', ['sections' => $sections])->assertOk();
        $this->postJson('/api/v1/admin/website/homepage-builder/publish', ['label' => 'v1'])->assertOk();

        $sections[0]['title'] = 'Hero V2';
        $this->putJson('/api/v1/admin/website/homepage-builder/draft', ['sections' => $sections])->assertOk();
        $this->postJson('/api/v1/admin/website/homepage-builder/publish', ['label' => 'v2'])->assertOk();

        $v1 = HomepageBuilderVersion::where('version_number', 1)->first();
        $this->assertNotNull($v1);

        $this->postJson('/api/v1/admin/website/homepage-builder/rollback/'.$v1->id)->assertOk();
        $this->assertSame('Hero V1', HomepageSection::where('slug', 'hero-builder')->value('title'));
        $this->assertDatabaseHas('activity_logs', ['activity' => 'HOMEPAGE_BUILDER_ROLLBACK']);
    }

    public function test_discard_resets_draft_to_published(): void
    {
        $this->seedSection();
        $this->actingAsRole(UserRole::MARKETING);

        $state = $this->getJson('/api/v1/admin/website/homepage-builder')->json('data');
        $sections = $state['draft']['sections'];
        $sections[0]['title'] = 'Dirty Title';
        $this->putJson('/api/v1/admin/website/homepage-builder/draft', ['sections' => $sections])
            ->assertOk()
            ->assertJsonPath('data.draft.isDirty', true);

        $this->postJson('/api/v1/admin/website/homepage-builder/discard')
            ->assertOk()
            ->assertJsonPath('data.draft.isDirty', false);

        $draft = HomepageBuilderDraft::where('key', 'homepage')->first();
        $this->assertSame('Hero', $draft->payload['sections'][0]['title'] ?? null);
    }
}
