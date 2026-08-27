<?php

namespace App\Services\Website;

use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\LegalDocument;
use App\Models\LegalDocumentVersion;
use App\Models\Setting;
use App\Models\StaticPage;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Marketing Legal Center (Sprint 7.3) — draft → preview → publish / rollback.
 */
class LegalCenterService
{
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
                Setting::where('key', 'legal_center_marketing_can_publish')->value('value') ?? 'true',
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
            abort(403, 'Anda tidak memiliki akses ke Legal Center.');
        }
    }

    public function assertCanDraft(): void
    {
        $this->assertCanView();
        if (! $this->permissions()['canDraft']) {
            abort(403, 'Mode baca saja. Anda tidak dapat mengubah draft Legal Center.');
        }
    }

    public function assertCanPublish(): void
    {
        $this->assertCanDraft();
        if (! $this->permissions()['canPublish']) {
            abort(403, 'Akun Marketing Staff hanya dapat menyimpan draft. Minta Manager / Owner untuk Publish.');
        }
    }

    public function ensureDefaults(): void
    {
        foreach (LegalDocument::catalog() as $item) {
            $existing = LegalDocument::query()->where('type', $item['type'])->first();
            if ($existing) {
                continue;
            }

            $static = StaticPage::query()->where('slug', $item['slug'])->first();
            $content = $static?->content
                ?? \App\Services\Legal\SrsLegalContent::html($item['type']);

            $doc = LegalDocument::create([
                'type' => $item['type'],
                'slug' => $item['slug'],
                'title' => $static?->title ?? $item['title'],
                'content' => $content,
                'draft_content' => $content,
                'is_dirty' => false,
                'seo_title' => $static?->seo_title ?? ($item['title'].' | GurkyNet'),
                'seo_description' => $static?->seo_description ?? ('Dokumen '.$item['title'].' GurkyNet.'),
                'seo_keywords' => 'gurkynet, legal, '.$item['slug'],
                'status' => 'published',
                'legal_review_status' => LegalDocument::REVIEW_PENDING,
                'estimated_reading_minutes' => $this->estimateReadingMinutes($content),
                'version_number' => 1,
                'published_at' => now(),
            ]);

            LegalDocumentVersion::create([
                'legal_document_id' => $doc->id,
                'version_number' => 1,
                'label' => 'Initial',
                'title' => $doc->title,
                'content' => $content,
                'seo_title' => $doc->seo_title,
                'seo_description' => $doc->seo_description,
                'seo_keywords' => $doc->seo_keywords,
                'source' => 'publish',
                'published_at' => now(),
            ]);

            if (! $static) {
                StaticPage::updateOrCreate(
                    ['slug' => $item['slug']],
                    [
                        'title' => $doc->title,
                        'content' => $content,
                        'seo_title' => $doc->seo_title,
                        'seo_description' => $doc->seo_description,
                        'status' => 'published',
                        'published_at' => now(),
                    ]
                );
            }
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function listForCms(): array
    {
        $this->assertCanView();
        $this->ensureDefaults();

        $docs = LegalDocument::query()
            ->with(['updater:id,name'])
            ->orderBy('id')
            ->get()
            ->map(fn (LegalDocument $doc) => $this->toCmsCard($doc))
            ->values()
            ->all();

        return [
            'permissions' => $this->permissions(),
            'documents' => $docs,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function showForCms(string $slug): array
    {
        $this->assertCanView();
        $this->ensureDefaults();
        $doc = LegalDocument::query()->where('slug', $slug)->firstOrFail();

        return [
            'permissions' => $this->permissions(),
            'document' => $this->toCmsDetail($doc),
            'versions' => $doc->versions()
                ->with('author:id,name')
                ->orderByDesc('version_number')
                ->limit(30)
                ->get()
                ->map(fn (LegalDocumentVersion $v) => [
                    'id' => $v->id,
                    'versionNumber' => $v->version_number,
                    'label' => $v->label,
                    'source' => $v->source,
                    'title' => $v->title,
                    'publishedAt' => optional($v->published_at)?->toIso8601String(),
                    'author' => $v->author ? ['id' => $v->author->id, 'name' => $v->author->name] : null,
                ])
                ->values()
                ->all(),
        ];
    }

    /**
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    public function saveDraft(string $slug, array $input): array
    {
        $this->assertCanDraft();
        $doc = LegalDocument::query()->where('slug', $slug)->firstOrFail();

        $draftContent = (string) ($input['draftContent'] ?? $input['draft_content'] ?? $doc->draft_content);
        $doc->fill([
            'title' => (string) ($input['title'] ?? $doc->title),
            'draft_content' => $draftContent,
            'seo_title' => $input['seoTitle'] ?? $input['seo_title'] ?? $doc->seo_title,
            'seo_description' => $input['seoDescription'] ?? $input['seo_description'] ?? $doc->seo_description,
            'seo_keywords' => $input['seoKeywords'] ?? $input['seo_keywords'] ?? $doc->seo_keywords,
            'canonical_url' => $input['canonicalUrl'] ?? $input['canonical_url'] ?? $doc->canonical_url,
            'og_image' => $input['ogImage'] ?? $input['og_image'] ?? $doc->og_image,
            'estimated_reading_minutes' => $this->estimateReadingMinutes($draftContent),
            'is_dirty' => true,
            'updated_by' => Auth::id(),
        ])->save();

        $this->log('LEGAL_CENTER_DRAFT_SAVED', [
            'slug' => $doc->slug,
            'type' => $doc->type,
        ]);

        return $this->showForCms($slug);
    }

    public function discardDraft(string $slug): array
    {
        $this->assertCanDraft();
        $doc = LegalDocument::query()->where('slug', $slug)->firstOrFail();
        $doc->forceFill([
            'draft_content' => $doc->content,
            'is_dirty' => false,
            'updated_by' => Auth::id(),
        ])->save();

        $this->log('LEGAL_CENTER_DRAFT_DISCARDED', ['slug' => $slug]);

        return $this->showForCms($slug);
    }

    public function publish(string $slug, ?string $label = null): array
    {
        $this->assertCanPublish();
        $doc = LegalDocument::query()->where('slug', $slug)->firstOrFail();
        $content = (string) ($doc->draft_content ?: $doc->content);
        if (trim(strip_tags($content)) === '') {
            throw ValidationException::withMessages(['content' => 'Konten draft kosong — tidak dapat publish.']);
        }

        DB::transaction(function () use ($doc, $content, $label) {
            $next = (int) $doc->version_number + 1;
            $doc->forceFill([
                'content' => $content,
                'draft_content' => $content,
                'is_dirty' => false,
                'status' => 'published',
                'version_number' => $next,
                'estimated_reading_minutes' => $this->estimateReadingMinutes($content),
                'published_at' => now(),
                'updated_by' => Auth::id(),
            ])->save();

            LegalDocumentVersion::create([
                'legal_document_id' => $doc->id,
                'version_number' => $next,
                'label' => $label ?: ('Version '.$next),
                'title' => $doc->title,
                'content' => $content,
                'seo_title' => $doc->seo_title,
                'seo_description' => $doc->seo_description,
                'seo_keywords' => $doc->seo_keywords,
                'source' => 'publish',
                'created_by' => Auth::id(),
                'published_at' => now(),
            ]);

            // Keep legacy static_pages in sync for old /page/{slug} links
            StaticPage::updateOrCreate(
                ['slug' => $doc->slug],
                [
                    'title' => $doc->title,
                    'content' => $content,
                    'seo_title' => $doc->seo_title,
                    'seo_description' => $doc->seo_description,
                    'status' => 'published',
                    'published_at' => now(),
                ]
            );
        });

        PublicLegalCache::forget();
        $this->log('LEGAL_CENTER_PUBLISHED', ['slug' => $slug, 'label' => $label]);

        return $this->showForCms($slug);
    }

    public function rollback(string $slug, int $versionId): array
    {
        $this->assertCanPublish();
        $doc = LegalDocument::query()->where('slug', $slug)->firstOrFail();
        $version = LegalDocumentVersion::query()
            ->where('legal_document_id', $doc->id)
            ->where('id', $versionId)
            ->firstOrFail();

        DB::transaction(function () use ($doc, $version) {
            $next = (int) $doc->version_number + 1;
            $content = (string) $version->content;

            $doc->forceFill([
                'title' => $version->title,
                'content' => $content,
                'draft_content' => $content,
                'seo_title' => $version->seo_title,
                'seo_description' => $version->seo_description,
                'seo_keywords' => $version->seo_keywords,
                'is_dirty' => false,
                'status' => 'published',
                'version_number' => $next,
                'estimated_reading_minutes' => $this->estimateReadingMinutes($content),
                'published_at' => now(),
                'updated_by' => Auth::id(),
            ])->save();

            LegalDocumentVersion::create([
                'legal_document_id' => $doc->id,
                'version_number' => $next,
                'label' => 'Rollback dari v'.$version->version_number,
                'title' => $doc->title,
                'content' => $content,
                'seo_title' => $doc->seo_title,
                'seo_description' => $doc->seo_description,
                'seo_keywords' => $doc->seo_keywords,
                'source' => 'rollback',
                'created_by' => Auth::id(),
                'published_at' => now(),
            ]);

            StaticPage::updateOrCreate(
                ['slug' => $doc->slug],
                [
                    'title' => $doc->title,
                    'content' => $content,
                    'seo_title' => $doc->seo_title,
                    'seo_description' => $doc->seo_description,
                    'status' => 'published',
                    'published_at' => now(),
                ]
            );
        });

        PublicLegalCache::forget();
        $this->log('LEGAL_CENTER_ROLLBACK', [
            'slug' => $slug,
            'from_version_id' => $versionId,
        ]);

        return $this->showForCms($slug);
    }

    /**
     * Public index of published legal docs.
     *
     * @return list<array<string, mixed>>
     */
    public function publicIndex(): array
    {
        $this->ensureDefaults();

        return LegalDocument::query()
            ->where('status', 'published')
            ->orderBy('id')
            ->get()
            ->map(fn (LegalDocument $doc) => [
                'type' => $doc->type,
                'slug' => $doc->slug,
                'title' => $doc->title,
                'icon' => collect(LegalDocument::catalog())->firstWhere('type', $doc->type)['icon'] ?? 'file-text',
                'lastUpdated' => optional($doc->published_at ?? $doc->updated_at)?->toIso8601String(),
                'estimatedReadingMinutes' => $doc->estimated_reading_minutes,
                'versionNumber' => $doc->version_number,
            ])
            ->values()
            ->all();
    }

    /**
     * @return array<string, mixed>|null
     */
    public function publicDocument(string $slug, bool $previewDraft = false): ?array
    {
        $this->ensureDefaults();
        $doc = LegalDocument::query()->where('slug', $slug)->first();
        if (! $doc) {
            return null;
        }

        if (! $previewDraft && ! $doc->isPublished()) {
            return null;
        }

        $content = $previewDraft ? (string) ($doc->draft_content ?: $doc->content) : (string) $doc->content;
        $baseUrl = rtrim((string) config('app.url'), '/');
        $canonical = $doc->canonical_url ?: ($baseUrl.'/legal/'.$doc->slug);

        return [
            'type' => $doc->type,
            'slug' => $doc->slug,
            'title' => $doc->title,
            'content' => $content,
            'seoTitle' => $doc->seo_title,
            'seoDescription' => $doc->seo_description,
            'seoKeywords' => $doc->seo_keywords,
            'canonicalUrl' => $canonical,
            'ogImage' => $doc->og_image,
            'lastUpdated' => optional($doc->published_at ?? $doc->updated_at)?->toIso8601String(),
            'estimatedReadingMinutes' => $doc->estimated_reading_minutes ?: $this->estimateReadingMinutes($content),
            'versionNumber' => $doc->version_number,
            'status' => $doc->status,
            'preview' => $previewDraft,
            'documents' => $this->publicIndex(),
            'schema' => [
                '@context' => 'https://schema.org',
                '@type' => 'WebPage',
                'name' => $doc->seo_title ?: $doc->title,
                'description' => $doc->seo_description,
                'url' => $canonical,
                'dateModified' => optional($doc->published_at ?? $doc->updated_at)?->toIso8601String(),
                'publisher' => [
                    '@type' => 'Organization',
                    'name' => 'GurkyNet',
                    'url' => $baseUrl,
                ],
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    protected function toCmsCard(LegalDocument $doc): array
    {
        return [
            'id' => $doc->id,
            'type' => $doc->type,
            'slug' => $doc->slug,
            'title' => $doc->title,
            'status' => $doc->status,
            'isDirty' => (bool) $doc->is_dirty,
            'versionNumber' => $doc->version_number,
            'lastUpdated' => optional($doc->updated_at)?->toIso8601String(),
            'publishedAt' => optional($doc->published_at)?->toIso8601String(),
            'updatedBy' => $doc->updater ? ['id' => $doc->updater->id, 'name' => $doc->updater->name] : null,
            'estimatedReadingMinutes' => $doc->estimated_reading_minutes,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    protected function toCmsDetail(LegalDocument $doc): array
    {
        return array_merge($this->toCmsCard($doc), [
            'content' => $doc->content,
            'draftContent' => $doc->draft_content,
            'seoTitle' => $doc->seo_title,
            'seoDescription' => $doc->seo_description,
            'seoKeywords' => $doc->seo_keywords,
            'canonicalUrl' => $doc->canonical_url,
            'ogImage' => $doc->og_image,
        ]);
    }

    protected function estimateReadingMinutes(?string $html): int
    {
        $text = trim(strip_tags((string) $html));
        $words = str_word_count($text);
        if ($words <= 0) {
            // Indonesian text without spaces between latin words — fallback by chars
            $words = (int) ceil(mb_strlen($text) / 5);
        }

        return max(1, (int) ceil($words / 200));
    }

    /**
     * Sprint 18 — refresh content from SRS templates; never sets approved_binding.
     */
    public function alignWithSrsContent(bool $publish = true): void
    {
        $this->ensureDefaults();
        foreach (LegalDocument::catalog() as $item) {
            $html = \App\Services\Legal\SrsLegalContent::html($item['type']);
            $doc = LegalDocument::query()->where('type', $item['type'])->firstOrFail();
            $doc->forceFill([
                'draft_content' => $html,
                'is_dirty' => true,
                'legal_review_status' => LegalDocument::REVIEW_PENDING,
            ])->save();

            if ($publish) {
                $next = (int) $doc->version_number + 1;
                $doc->forceFill([
                    'content' => $html,
                    'draft_content' => $html,
                    'is_dirty' => false,
                    'status' => 'published',
                    'version_number' => max(1, $next),
                    'published_at' => now(),
                    'estimated_reading_minutes' => $this->estimateReadingMinutes($html),
                    'legal_review_status' => LegalDocument::REVIEW_PENDING,
                ])->save();

                \App\Models\LegalDocumentVersion::create([
                    'legal_document_id' => $doc->id,
                    'version_number' => $doc->version_number,
                    'label' => 'SRS alignment',
                    'title' => $doc->title,
                    'content' => $html,
                    'seo_title' => $doc->seo_title,
                    'seo_description' => $doc->seo_description,
                    'seo_keywords' => $doc->seo_keywords,
                    'source' => 'publish',
                    'published_at' => now(),
                ]);

                StaticPage::updateOrCreate(
                    ['slug' => $doc->slug],
                    [
                        'title' => $doc->title,
                        'content' => $html,
                        'status' => 'published',
                        'seo_title' => $doc->seo_title,
                        'seo_description' => $doc->seo_description,
                    ]
                );
            }
        }
        app(PublicLegalCache::class);
        PublicLegalCache::forgetCachesOnly();
    }

    protected function defaultHtml(string $type, string $title): string
    {
        return \App\Services\Legal\SrsLegalContent::html($type);
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
