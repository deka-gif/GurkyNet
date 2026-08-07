<?php

namespace Tests\Feature\Admin;

use App\Enums\UserRole;
use App\Models\LegalDocument;
use App\Models\LegalDocumentVersion;
use App\Models\Setting;
use App\Models\User;
use App\Services\Website\PublicLegalCache;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LegalCenterTest extends TestCase
{
    use RefreshDatabase;

    protected function actingAsRole(UserRole $role): User
    {
        $user = User::create([
            'name' => $role->label(),
            'email' => $role->value.'-legal@gurkypay.com',
            'phone_number' => '0813'.random_int(10000000, 99999999),
            'password' => Hash::make('password123'),
            'role' => $role,
            'transaction_pin' => Hash::make('123456'),
        ]);
        Sanctum::actingAs($user);

        return $user;
    }

    public function test_marketing_can_draft_publish_and_public_sees_published_only(): void
    {
        Cache::flush();
        $this->actingAsRole(UserRole::MARKETING);

        $list = $this->getJson('/api/v1/admin/website/legal-center')->assertOk()->json('data');
        $this->assertTrue($list['permissions']['canDraft']);
        $this->assertTrue($list['permissions']['canPublish']);
        $this->assertCount(3, $list['documents']);

        $slug = 'privacy-policy';
        $this->putJson("/api/v1/admin/website/legal-center/{$slug}/draft", [
            'title' => 'Privacy Policy Updated',
            'draftContent' => '<h2>Privasi</h2><p>Draft secret content.</p><h3>Detail</h3><p>More.</p>',
            'seoTitle' => 'Privacy | GurkyNet',
            'seoDescription' => 'Updated privacy policy',
        ])->assertOk()->assertJsonPath('data.document.isDirty', true);

        // Public still sees old published content (not draft)
        Cache::flush();
        $publicBefore = $this->getJson("/api/v1/public/legal/{$slug}")->assertOk()->json('data');
        $this->assertStringNotContainsString('Draft secret content', (string) $publicBefore['content']);

        $this->postJson("/api/v1/admin/website/legal-center/{$slug}/publish", ['label' => 'Legal Sprint'])
            ->assertOk()
            ->assertJsonPath('data.document.isDirty', false);

        $this->assertDatabaseHas('activity_logs', ['activity' => 'LEGAL_CENTER_PUBLISHED']);
        $this->assertFalse(Cache::has(PublicLegalCache::docKey($slug)));

        $publicAfter = $this->getJson("/api/v1/public/legal/{$slug}")->assertOk()->json('data');
        $this->assertStringContainsString('Draft secret content', (string) $publicAfter['content']);
        $this->assertSame('Privacy Policy Updated', $publicAfter['title']);
        $this->assertNotEmpty($publicAfter['schema']);
        $this->assertNotEmpty($publicAfter['canonicalUrl']);
    }

    public function test_operations_is_read_only(): void
    {
        $this->actingAsRole(UserRole::OPERATIONS);

        $this->getJson('/api/v1/admin/website/legal-center')->assertOk()
            ->assertJsonPath('data.permissions.canDraft', false)
            ->assertJsonPath('data.permissions.canPublish', false);

        $this->putJson('/api/v1/admin/website/legal-center/privacy-policy/draft', [
            'draftContent' => '<p>Nope</p>',
        ])->assertStatus(403);
    }

    public function test_marketing_staff_cannot_publish_when_setting_disabled(): void
    {
        Setting::updateOrCreate(
            ['key' => 'legal_center_marketing_can_publish'],
            ['value' => 'false']
        );

        $this->actingAsRole(UserRole::MARKETING);

        $this->getJson('/api/v1/admin/website/legal-center')->assertOk()
            ->assertJsonPath('data.permissions.canDraft', true)
            ->assertJsonPath('data.permissions.canPublish', false);

        $this->putJson('/api/v1/admin/website/legal-center/terms-conditions/draft', [
            'draftContent' => '<h2>Terms</h2><p>Draft only.</p>',
        ])->assertOk();

        $this->postJson('/api/v1/admin/website/legal-center/terms-conditions/publish')
            ->assertStatus(403);
    }

    public function test_owner_can_rollback(): void
    {
        $this->actingAsRole(UserRole::OWNER);

        $this->getJson('/api/v1/admin/website/legal-center')->assertOk();
        $slug = 'refund-policy';

        $this->putJson("/api/v1/admin/website/legal-center/{$slug}/draft", [
            'draftContent' => '<h2>Refund V2</h2><p>Version two body.</p>',
        ])->assertOk();

        $this->postJson("/api/v1/admin/website/legal-center/{$slug}/publish", ['label' => 'v2'])
            ->assertOk();

        $doc = LegalDocument::where('slug', $slug)->firstOrFail();
        $first = LegalDocumentVersion::where('legal_document_id', $doc->id)
            ->where('version_number', 1)
            ->firstOrFail();

        $this->postJson("/api/v1/admin/website/legal-center/{$slug}/rollback/{$first->id}")
            ->assertOk()
            ->assertJsonPath('data.document.isDirty', false);

        $this->assertDatabaseHas('activity_logs', ['activity' => 'LEGAL_CENTER_ROLLBACK']);

        $live = $this->getJson("/api/v1/public/legal/{$slug}")->assertOk()->json('data');
        $this->assertStringNotContainsString('Version two body', (string) $live['content']);
    }

    public function test_public_legal_index_lists_published_documents(): void
    {
        $this->actingAsRole(UserRole::MARKETING);
        $this->getJson('/api/v1/admin/website/legal-center')->assertOk();

        $this->app['auth']->forgetGuards();

        $res = $this->getJson('/api/v1/public/legal')->assertOk()->json('data');
        $this->assertGreaterThanOrEqual(3, count($res['documents']));
    }
}
