<?php

namespace App\Services\Website;

use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\Faq;
use App\Models\HomepageBuilderDraft;
use App\Models\HomepageBuilderVersion;
use App\Models\HomepageSection;
use App\Models\Setting;
use App\Models\User;
use App\Repositories\Contracts\HomepageSectionRepositoryInterface;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Marketing Homepage Section Builder (Sprint 7.2).
 * Draft → Preview → Publish / Discard / Rollback. Public site only reads published sections.
 */
class HomepageBuilderService
{
    public const DRAFT_KEY = 'homepage';

    public function __construct(
        protected HomepageSectionRepositoryInterface $sections
    ) {}

    /**
     * @return array{canView:bool,canDraft:bool,canPublish:bool,role:string}
     */
    public function permissions(?User $user = null): array
    {
        $user = $user ?? Auth::user();
        $role = strtolower((string) ($user?->role?->value ?? $user?->role ?? ''));

        if (in_array($role, [UserRole::SUPER_ADMIN->value, UserRole::OWNER->value], true)) {
            return ['canView' => true, 'canDraft' => true, 'canPublish' => true, 'role' => $role];
        }

        if ($role === UserRole::OPERATIONS->value) {
            return ['canView' => true, 'canDraft' => false, 'canPublish' => false, 'role' => $role];
        }

        if ($role === UserRole::MARKETING->value) {
            $canPublish = filter_var(
                Setting::where('key', 'homepage_builder_marketing_can_publish')->value('value') ?? 'true',
                FILTER_VALIDATE_BOOLEAN
            );

            return [
                'canView' => true,
                'canDraft' => true,
                'canPublish' => $canPublish,
                'role' => $role,
            ];
        }

        return ['canView' => false, 'canDraft' => false, 'canPublish' => false, 'role' => $role];
    }

    public function assertCanView(): void
    {
        if (! $this->permissions()['canView']) {
            abort(403, 'Anda tidak memiliki akses ke Homepage Builder.');
        }
    }

    public function assertCanDraft(): void
    {
        $p = $this->permissions();
        if (! $p['canView']) {
            abort(403, 'Anda tidak memiliki akses ke Homepage Builder.');
        }
        if (! $p['canDraft']) {
            abort(403, 'Mode baca saja. Anda tidak dapat mengubah draft Homepage.');
        }
    }

    public function assertCanPublish(): void
    {
        $this->assertCanDraft();
        if (! $this->permissions()['canPublish']) {
            abort(403, 'Akun Marketing Staff hanya dapat menyimpan draft. Minta Marketing Manager / Owner untuk Publish.');
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function getBuilderState(): array
    {
        $this->assertCanView();
        $draft = $this->ensureDraft();
        $latestVersion = HomepageBuilderVersion::query()->orderByDesc('version_number')->first();

        return [
            'permissions' => $this->permissions(),
            'draft' => [
                'key' => $draft->key,
                'isDirty' => (bool) $draft->is_dirty,
                'updatedAt' => optional($draft->updated_at)?->toIso8601String(),
                'updatedBy' => $draft->updated_by,
                'sections' => $draft->payload['sections'] ?? [],
            ],
            'published' => [
                'sections' => $this->snapshotFromLiveSections(),
                'latestVersion' => $latestVersion?->version_number,
                'latestPublishedAt' => optional($latestVersion?->published_at)?->toIso8601String(),
            ],
            'versions' => HomepageBuilderVersion::query()
                ->with('author:id,name,email')
                ->orderByDesc('version_number')
                ->limit(30)
                ->get()
                ->map(fn (HomepageBuilderVersion $v) => [
                    'id' => $v->id,
                    'versionNumber' => $v->version_number,
                    'label' => $v->label,
                    'source' => $v->source,
                    'publishedAt' => optional($v->published_at)?->toIso8601String(),
                    'createdAt' => optional($v->created_at)?->toIso8601String(),
                    'author' => $v->author ? [
                        'id' => $v->author->id,
                        'name' => $v->author->name,
                    ] : null,
                ])
                ->values()
                ->all(),
        ];
    }

    /**
     * Replace entire draft payload (reorder + edits).
     *
     * @param  array{sections?: list<array<string, mixed>>}  $input
     * @return array<string, mixed>
     */
    public function saveDraft(array $input): array
    {
        $this->assertCanDraft();
        $sections = $input['sections'] ?? null;
        if (! is_array($sections)) {
            throw ValidationException::withMessages(['sections' => 'Draft sections wajib berupa array.']);
        }

        $normalized = $this->normalizeDraftSections($sections);
        $draft = $this->ensureDraft();
        $draft->forceFill([
            'payload' => ['sections' => $normalized],
            'is_dirty' => true,
            'updated_by' => Auth::id(),
        ])->save();

        $this->log('HOMEPAGE_BUILDER_DRAFT_SAVED', [
            'section_count' => count($normalized),
        ]);

        return $this->getBuilderState();
    }

    /**
     * @param  list<array{id?:int|string}>  $orderedIds  tempKey or id in new order
     */
    public function reorder(array $orderedIds): array
    {
        $this->assertCanDraft();
        $draft = $this->ensureDraft();
        $sections = $draft->payload['sections'] ?? [];
        $map = [];
        foreach ($sections as $sec) {
            $key = (string) ($sec['tempKey'] ?? $sec['id'] ?? '');
            if ($key !== '') {
                $map[$key] = $sec;
            }
        }

        $reordered = [];
        $order = 1;
        foreach ($orderedIds as $id) {
            $key = (string) $id;
            if (! isset($map[$key])) {
                continue;
            }
            $row = $map[$key];
            $row['displayOrder'] = $order++;
            $reordered[] = $row;
            unset($map[$key]);
        }
        foreach ($map as $row) {
            $row['displayOrder'] = $order++;
            $reordered[] = $row;
        }

        $draft->forceFill([
            'payload' => ['sections' => $reordered],
            'is_dirty' => true,
            'updated_by' => Auth::id(),
        ])->save();

        $this->log('HOMEPAGE_BUILDER_SECTION_REORDERED', [
            'order' => array_map(fn ($s) => $s['tempKey'] ?? $s['id'] ?? null, $reordered),
        ]);

        return $this->getBuilderState();
    }

    public function discardDraft(): array
    {
        $this->assertCanDraft();
        $draft = $this->ensureDraft();
        $draft->forceFill([
            'payload' => ['sections' => $this->snapshotFromLiveSections()],
            'is_dirty' => false,
            'updated_by' => Auth::id(),
        ])->save();

        $this->log('HOMEPAGE_BUILDER_DRAFT_DISCARDED', []);

        return $this->getBuilderState();
    }

    public function publish(?string $label = null): array
    {
        $this->assertCanPublish();
        $draft = $this->ensureDraft();
        $sections = $draft->payload['sections'] ?? [];
        if ($sections === []) {
            throw ValidationException::withMessages(['sections' => 'Draft kosong — tidak dapat publish.']);
        }

        DB::transaction(function () use ($draft, $sections, $label) {
            $this->applySectionsToLive($sections);

            $next = (int) (HomepageBuilderVersion::max('version_number') ?? 0) + 1;
            HomepageBuilderVersion::create([
                'version_number' => $next,
                'label' => $label ?: ('Version '.$next),
                'payload' => ['sections' => $this->snapshotFromLiveSections()],
                'source' => 'publish',
                'created_by' => Auth::id(),
                'published_at' => now(),
            ]);

            $draft->forceFill([
                'payload' => ['sections' => $this->snapshotFromLiveSections()],
                'is_dirty' => false,
                'updated_by' => Auth::id(),
            ])->save();
        });

        PublicHomepageCache::forget();

        $this->log('HOMEPAGE_BUILDER_PUBLISHED', [
            'label' => $label,
            'section_count' => count($sections),
        ]);

        return $this->getBuilderState();
    }

    public function rollback(int $versionId): array
    {
        $this->assertCanPublish();
        $version = HomepageBuilderVersion::findOrFail($versionId);
        $sections = $version->payload['sections'] ?? [];
        if (! is_array($sections) || $sections === []) {
            throw ValidationException::withMessages(['version' => 'Versi tidak memiliki data section.']);
        }

        DB::transaction(function () use ($version, $sections) {
            $this->applySectionsToLive($sections);

            $next = (int) (HomepageBuilderVersion::max('version_number') ?? 0) + 1;
            HomepageBuilderVersion::create([
                'version_number' => $next,
                'label' => 'Rollback dari v'.$version->version_number,
                'payload' => ['sections' => $this->snapshotFromLiveSections()],
                'source' => 'rollback',
                'created_by' => Auth::id(),
                'published_at' => now(),
            ]);

            $draft = $this->ensureDraft();
            $draft->forceFill([
                'payload' => ['sections' => $this->snapshotFromLiveSections()],
                'is_dirty' => false,
                'updated_by' => Auth::id(),
            ])->save();
        });

        PublicHomepageCache::forget();

        $this->log('HOMEPAGE_BUILDER_ROLLBACK', [
            'from_version_id' => $versionId,
            'from_version_number' => $version->version_number,
        ]);

        return $this->getBuilderState();
    }

    /**
     * Preview uses draft sections (including disabled=false only for enabled ones).
     *
     * @return list<array<string, mixed>>
     */
    public function previewSections(): array
    {
        $this->assertCanView();
        $draft = $this->ensureDraft();
        $sections = $draft->payload['sections'] ?? [];

        return collect($sections)
            ->filter(fn ($s) => (bool) ($s['enabled'] ?? true))
            ->sortBy(fn ($s) => (int) ($s['displayOrder'] ?? 0))
            ->values()
            ->all();
    }

    protected function ensureDraft(): HomepageBuilderDraft
    {
        $draft = HomepageBuilderDraft::query()->where('key', self::DRAFT_KEY)->first();
        if ($draft) {
            return $draft;
        }

        return HomepageBuilderDraft::create([
            'key' => self::DRAFT_KEY,
            'payload' => ['sections' => $this->snapshotFromLiveSections()],
            'is_dirty' => false,
            'updated_by' => Auth::id(),
        ]);
    }

    /**
     * @return list<array<string, mixed>>
     */
    protected function snapshotFromLiveSections(): array
    {
        return $this->sections->all()->map(function (HomepageSection $s) {
            return $this->sectionToDraftRow($s);
        })->values()->all();
    }

    /**
     * @return array<string, mixed>
     */
    protected function sectionToDraftRow(HomepageSection $s): array
    {
        return [
            'id' => $s->id,
            'tempKey' => 'sec-'.$s->id,
            'title' => $s->title,
            'subtitle' => $s->subtitle,
            'slug' => $s->slug,
            'componentType' => $s->component_type,
            'enabled' => (bool) $s->visible && ($s->status === 'active'),
            'displayOrder' => (int) $s->display_order,
            'status' => $s->status,
            'description' => $s->description,
            'backgroundColor' => $s->background_color,
            'textColor' => $s->text_color,
            'buttonLabel' => $s->button_label,
            'buttonUrl' => $s->button_url,
            'animation' => $s->animation ?: 'fade',
            'contentItems' => $s->content_items ?: [],
            'config' => $s->config ?: [],
            'heroBackgroundMediaId' => $s->hero_background_media_id,
            'heroIllustrationMediaId' => $s->hero_illustration_media_id,
            'heroMobileImageMediaId' => $s->hero_mobile_image_media_id,
            'createdBy' => $s->created_by,
            'updatedBy' => $s->updated_by,
            'updatedAt' => optional($s->updated_at)?->toIso8601String(),
        ];
    }

    /**
     * @param  list<array<string, mixed>>  $sections
     * @return list<array<string, mixed>>
     */
    protected function normalizeDraftSections(array $sections): array
    {
        $out = [];
        $order = 1;
        foreach ($sections as $row) {
            if (! is_array($row)) {
                continue;
            }
            $tempKey = (string) ($row['tempKey'] ?? '');
            if ($tempKey === '') {
                $tempKey = 'tmp-'.Str::uuid()->toString();
            }
            $out[] = [
                'id' => $row['id'] ?? null,
                'tempKey' => $tempKey,
                'title' => (string) ($row['title'] ?? 'Untitled'),
                'subtitle' => $row['subtitle'] ?? null,
                'slug' => (string) ($row['slug'] ?? Str::slug((string) ($row['title'] ?? 'section')).'-'.Str::random(4)),
                'componentType' => (string) ($row['componentType'] ?? 'promo'),
                'enabled' => (bool) ($row['enabled'] ?? true),
                'displayOrder' => $order++,
                'status' => ($row['enabled'] ?? true) ? 'active' : 'draft',
                'description' => $row['description'] ?? null,
                'backgroundColor' => $row['backgroundColor'] ?? null,
                'textColor' => $row['textColor'] ?? null,
                'buttonLabel' => $row['buttonLabel'] ?? null,
                'buttonUrl' => $row['buttonUrl'] ?? null,
                'animation' => $row['animation'] ?? 'fade',
                'contentItems' => is_array($row['contentItems'] ?? null) ? $row['contentItems'] : [],
                'config' => is_array($row['config'] ?? null) ? $row['config'] : [],
                'heroBackgroundMediaId' => $row['heroBackgroundMediaId'] ?? null,
                'heroIllustrationMediaId' => $row['heroIllustrationMediaId'] ?? null,
                'heroMobileImageMediaId' => $row['heroMobileImageMediaId'] ?? null,
                'createdBy' => $row['createdBy'] ?? null,
                'updatedBy' => Auth::id(),
                'updatedAt' => now()->toIso8601String(),
            ];
        }

        return $out;
    }

    /**
     * @param  list<array<string, mixed>>  $sections
     */
    protected function applySectionsToLive(array $sections): void
    {
        $normalized = $this->normalizeDraftSections($sections);
        $keepIds = [];

        foreach ($normalized as $row) {
            $enabled = (bool) ($row['enabled'] ?? true);
            $attrs = [
                'title' => $row['title'],
                'subtitle' => $row['subtitle'],
                'slug' => $row['slug'],
                'component_type' => $row['componentType'],
                'display_order' => (int) $row['displayOrder'],
                'visible' => $enabled,
                'status' => $enabled ? 'active' : 'draft',
                'description' => $row['description'],
                'background_color' => $row['backgroundColor'],
                'text_color' => $row['textColor'],
                'button_label' => $row['buttonLabel'],
                'button_url' => $row['buttonUrl'],
                'animation' => $row['animation'],
                'content_items' => $row['contentItems'],
                'config' => $row['config'],
                'hero_background_media_id' => $row['heroBackgroundMediaId'],
                'hero_illustration_media_id' => $row['heroIllustrationMediaId'],
                'hero_mobile_image_media_id' => $row['heroMobileImageMediaId'],
                'updated_by' => Auth::id(),
            ];

            $existing = null;
            if (! empty($row['id'])) {
                $existing = HomepageSection::find($row['id']);
            }
            if (! $existing) {
                $existing = HomepageSection::where('slug', $row['slug'])->first();
            }

            if ($existing) {
                $existing->fill($attrs)->save();
                $keepIds[] = $existing->id;
            } else {
                $attrs['created_by'] = Auth::id();
                $created = HomepageSection::create($attrs);
                $keepIds[] = $created->id;
            }

            if ($row['componentType'] === 'faq' && is_array($row['contentItems'])) {
                $this->syncFaqsFromContentItems($row['contentItems']);
            }
        }

        // Soft-disable sections removed from builder layout
        HomepageSection::query()
            ->when($keepIds !== [], fn ($q) => $q->whereNotIn('id', $keepIds))
            ->update([
                'visible' => false,
                'status' => 'draft',
                'updated_by' => Auth::id(),
            ]);
    }

    /**
     * @param  list<array<string, mixed>>  $items
     */
    protected function syncFaqsFromContentItems(array $items): void
    {
        $order = 1;
        $kept = [];
        foreach ($items as $item) {
            $q = trim((string) ($item['title'] ?? $item['question'] ?? ''));
            $a = trim((string) ($item['description'] ?? $item['answer'] ?? ''));
            if ($q === '' || $a === '') {
                continue;
            }
            $faq = Faq::query()->where('question', $q)->first();
            if ($faq) {
                $faq->update(['answer' => $a, 'order' => $order]);
            } else {
                $faq = Faq::create(['question' => $q, 'answer' => $a, 'order' => $order]);
            }
            $kept[] = $faq->id;
            $order++;
        }

        if ($kept !== []) {
            Faq::query()->whereNotIn('id', $kept)->delete();
        }
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    protected function log(string $activity, array $payload): void
    {
        ActivityLog::create([
            'user_id' => Auth::id(),
            'activity' => $activity,
            'payload' => $payload,
        ]);
    }
}
