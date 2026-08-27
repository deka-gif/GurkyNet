<?php

namespace App\Services\Workflow;

use App\Actions\Admin\Website\StaticPageAction;
use App\Enums\TransactionStatus;
use App\Enums\UserRole;
use App\Models\DivisionNotification;
use App\Models\Faq;
use App\Models\Product;
use App\Models\ProductProvider;
use App\Models\ProductProviderSku;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Workflow;
use App\Repositories\Contracts\MarketingRepositoryInterface;
use App\Services\ProductProviders\ProductProviderControlService;
use App\Services\WalletRefundService;
use App\Support\Transactions\TransactionStatusMapper;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class WorkflowActionService
{
    public function __construct(
        protected WorkflowEngineService $engine,
        protected WalletRefundService $walletRefund,
        protected StaticPageAction $staticPages,
        protected MarketingRepositoryInterface $marketing,
        protected ProductProviderControlService $providerControl
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function execute(Workflow $workflow, User $actor, array $data): Workflow
    {
        $action = (string) ($data['action'] ?? '');
        $note = $data['note'] ?? $data['resolution_note'] ?? $data['resolutionNote'] ?? null;
        $payload = is_array($data['payload'] ?? null) ? $data['payload'] : [];

        $this->assertCanAct($workflow, $actor, $action);

        return match ($action) {
            // Operations
            'retry', 'provider_retry' => $this->opsRetryIntent($workflow, $actor, $action, $note, $payload),
            'sku_disable' => $this->opsSkuToggle($workflow, $actor, false, $note, $payload),
            'sku_enable' => $this->opsSkuToggle($workflow, $actor, true, $note, $payload),
            'maintenance' => $this->opsMaintenance($workflow, $actor, $note, $payload),
            'need_refund' => $this->opsNeedRefund($workflow, $actor, $note, $payload),
            'resolve' => $this->resolve($workflow, $actor, $note),
            'create_sop' => $this->createSopDraft($workflow, $actor, $note, $payload),
            'escalate_admin' => $this->escalateAdmin($workflow, $actor, $note),

            // Finance
            'approve', 'full_refund' => $this->financeApprove($workflow, $actor, $note),
            'partial_refund' => $this->financePartial($workflow, $actor, $note, $payload),
            'reject' => $this->reject($workflow, $actor, $note),
            'need_investigation' => $this->needInvestigation($workflow, $actor, $note),

            // Marketing
            'create_faq_draft' => $this->marketingFaqDraft($workflow, $actor, $note, $payload),
            'create_knowledge_draft' => $this->marketingKnowledgeDraft($workflow, $actor, $note, $payload),
            'create_announcement_draft' => $this->marketingAnnouncementDraft($workflow, $actor, $note, $payload),
            'create_banner', 'update_homepage', 'update_knowledge' => $this->marketingDeepLink($workflow, $actor, $action, $note),

            default => throw ValidationException::withMessages(['action' => 'Aksi tidak dikenali: '.$action]),
        };
    }

    protected function opsRetryIntent(Workflow $workflow, User $actor, string $action, ?string $note, array $payload): Workflow
    {
        $this->engine->recordAction(
            $workflow,
            $actor,
            'retry_intent',
            $note ?: 'Retry provider dicatat sebagai intent (engine Digiflazz tidak dijalankan).',
            array_merge($payload, [
                'intent' => true,
                'dispatched_job' => false,
            ]),
            [
                'retry_intent' => [
                    'at' => now()->toIso8601String(),
                    'by' => $actor->id,
                    'open' => true,
                ],
            ]
        );

        return $workflow->fresh($this->engine->defaultRelations());
    }

    protected function opsSkuToggle(Workflow $workflow, User $actor, bool $enable, ?string $note, array $payload): Workflow
    {
        $skuId = $payload['product_provider_sku_id']
            ?? $payload['productProviderSkuId']
            ?? $workflow->product_provider_sku_id;

        $productId = $payload['product_id'] ?? $payload['productId'] ?? $workflow->product_id;

        $changed = null;
        if ($skuId) {
            $sku = ProductProviderSku::query()->find($skuId);
            if ($sku) {
                $sku->is_active = $enable;
                $sku->save();
                $changed = ['type' => 'product_provider_sku', 'id' => $sku->id, 'is_active' => $enable];
            }
        } elseif ($productId) {
            $product = Product::query()->find($productId);
            if ($product && array_key_exists('is_active', $product->getAttributes())) {
                $product->is_active = $enable;
                $product->save();
                $changed = ['type' => 'product', 'id' => $product->id, 'is_active' => $enable];
            }
        }

        if (! $changed) {
            throw ValidationException::withMessages([
                'payload' => 'SKU/Product tidak ditemukan untuk enable/disable.',
            ]);
        }

        $this->engine->recordAction(
            $workflow,
            $actor,
            $enable ? 'sku_enable' : 'sku_disable',
            $note ?: (($enable ? 'Enable' : 'Disable').' SKU'),
            $changed,
            ['last_sku_action' => $changed]
        );

        return $workflow->fresh($this->engine->defaultRelations());
    }

    protected function opsMaintenance(Workflow $workflow, User $actor, ?string $note, array $payload): Workflow
    {
        $providerId = $payload['product_provider_id']
            ?? $payload['productProviderId']
            ?? ($workflow->meta['product_provider_id'] ?? null)
            ?? ($workflow->meta['ops_snapshot']['product_provider_id'] ?? null);

        $changed = null;
        if ($providerId) {
            $provider = ProductProvider::query()->find($providerId);
            if ($provider) {
                $fresh = $this->providerControl->setMaintenance($provider);
                $changed = [
                    'type' => 'product_provider',
                    'id' => $fresh->id,
                    'code' => $fresh->code,
                    'partner_status' => $fresh->partner_status,
                ];

                DivisionNotification::create([
                    'role' => 'marketing',
                    'type' => 'provider_maintenance',
                    'title' => 'Provider maintenance: '.$fresh->name,
                    'body' => $note ?: ('Ops set '.$fresh->code.' to maintenance'),
                    'payload' => ['product_provider_id' => $fresh->id, 'workflow_id' => $workflow->id],
                    'related_type' => 'workflow',
                    'related_id' => $workflow->id,
                ]);
            }
        }

        $this->engine->recordAction(
            $workflow,
            $actor,
            'maintenance',
            $note ?: ($changed ? 'Provider set to maintenance' : 'Ditandai maintenance (provider id tidak diketahui)'),
            array_merge($payload, ['changed' => $changed]),
            [
                'maintenance' => [
                    'at' => now()->toIso8601String(),
                    'note' => $note,
                    'provider' => $changed,
                ],
            ]
        );

        return $workflow->fresh($this->engine->defaultRelations());
    }

    protected function opsNeedRefund(Workflow $workflow, User $actor, ?string $note, array $payload): Workflow
    {
        $meta = is_array($workflow->meta) ? $workflow->meta : [];
        $meta['need_refund'] = [
            'at' => now()->toIso8601String(),
            'by' => $actor->id,
            'note' => $note,
            'payload' => $payload,
        ];

        $workflow->update([
            'category' => 'refund_request',
            'meta' => $meta,
        ]);

        $this->engine->recordAction(
            $workflow->fresh(),
            $actor,
            'need_refund',
            $note ?: 'Ops escalate need_refund ke Finance',
            array_merge($payload, ['category' => 'refund_request']),
            ['need_refund' => $meta['need_refund']]
        );

        DivisionNotification::create([
            'role' => 'finance',
            'type' => 'need_refund',
            'title' => 'Need refund: '.$workflow->workflow_code,
            'body' => $note ?: $workflow->title,
            'payload' => ['workflow_id' => $workflow->id],
            'related_type' => 'workflow',
            'related_id' => $workflow->id,
        ]);

        return $this->engine->escalate(
            $workflow->fresh(),
            $actor,
            'finance',
            $note ?: 'Ops: need_refund → Finance Refund Queue'
        );
    }

    protected function createSopDraft(Workflow $workflow, User $actor, ?string $note, array $payload): Workflow
    {
        $title = $payload['title'] ?? ('SOP '.$workflow->workflow_code);
        $slug = 'sop-wf-'.$workflow->id.'-'.Str::slug(Str::limit($title, 40, ''));
        $content = $payload['content'] ?? ($note ?: $workflow->description ?: 'Draft SOP dari workflow.');

        $page = $this->staticPages->create([
            'title' => $title,
            'slug' => $slug,
            'content' => $content,
            'status' => 'draft',
            'seo_title' => $title,
            'seo_description' => Str::limit(strip_tags((string) $content), 160),
        ]);

        $this->engine->recordAction(
            $workflow,
            $actor,
            'create_sop',
            'SOP draft dibuat: '.$page->title,
            ['static_page_id' => $page->id, 'slug' => $page->slug, 'status' => $page->status],
            ['sop_draft_id' => $page->id]
        );

        return $workflow->fresh($this->engine->defaultRelations());
    }

    protected function financeApprove(Workflow $workflow, User $actor, ?string $note): Workflow
    {
        if (! $workflow->transaction_id) {
            throw ValidationException::withMessages([
                'transaction_id' => 'Workflow tidak memiliki transaksi untuk refund.',
            ]);
        }

        /** @var Transaction $tx */
        $tx = Transaction::query()->findOrFail($workflow->transaction_id);

        // FR-DIFF-09 / SRS 14.3 + 14.5 — SUCCESS complaint → REFUNDED (never FAILED).
        if (TransactionStatusMapper::isSuccess($tx->status)) {
            $result = $this->walletRefund->refundSuccessToRefunded(
                $tx,
                'Refund workflow '.$workflow->workflow_code,
                'finance',
                $note ? ('WF: '.$note) : ('WF '.$workflow->workflow_code)
            );
        } else {
            $result = $this->walletRefund->refundOnce(
                $tx,
                'Refund workflow '.$workflow->workflow_code,
                'finance',
                $note ? ('WF: '.$note) : ('WF '.$workflow->workflow_code),
                TransactionStatus::CANCELED->value
            );
        }

        $this->engine->recordAction(
            $workflow,
            $actor,
            'refund_approve',
            $note ?: 'Refund disetujui',
            [
                'credited' => $result['credited'],
                'already_refunded' => $result['already_refunded'],
                'transaction_id' => $tx->id,
            ],
            [
                'refund' => [
                    'credited' => $result['credited'],
                    'already_refunded' => $result['already_refunded'],
                    'at' => now()->toIso8601String(),
                ],
            ]
        );

        return $this->engine->transitionStatus(
            $workflow->fresh(),
            $actor,
            'resolved',
            $note ?: 'Refund selesai — workflow resolved',
            'resolved',
            'refund_approve'
        );
    }

    protected function financePartial(Workflow $workflow, User $actor, ?string $note, array $payload): Workflow
    {
        $this->engine->recordAction(
            $workflow,
            $actor,
            'partial_refund_noted',
            $note ?: 'Partial refund dicatat (tanpa engine wallet baru). Gunakan full refund atau investigasi.',
            array_merge($payload, ['needs_partial' => true]),
            [
                'needs_partial' => true,
                'partial_note' => $note,
            ]
        );

        return $this->engine->transitionStatus(
            $workflow->fresh(),
            $actor,
            'waiting_finance',
            $note ?: 'Need investigation / partial — menunggu review Finance',
            'status_changed',
            'need_investigation',
            ['meta' => ['needs_review' => true]]
        );
    }

    protected function needInvestigation(Workflow $workflow, User $actor, ?string $note): Workflow
    {
        $this->engine->recordAction(
            $workflow,
            $actor,
            'need_investigation',
            $note ?: 'Perlu investigasi lanjutan',
            [],
            ['needs_review' => true]
        );

        return $workflow->fresh($this->engine->defaultRelations());
    }

    protected function marketingFaqDraft(Workflow $workflow, User $actor, ?string $note, array $payload): Workflow
    {
        $question = $payload['question'] ?? ('[DRAFT] '.$workflow->title);
        $answer = $payload['answer'] ?? ($note ?: $workflow->description ?: 'Draft FAQ dari workflow.');

        $faq = Faq::create([
            'question' => $question,
            'answer' => $answer,
            'order' => (int) (Faq::query()->max('order') ?? 0) + 1,
        ]);

        $this->engine->recordAction(
            $workflow,
            $actor,
            'create_faq_draft',
            'FAQ draft dibuat',
            ['faq_id' => $faq->id],
            ['faq_id' => $faq->id]
        );

        return $workflow->fresh($this->engine->defaultRelations());
    }

    protected function marketingKnowledgeDraft(Workflow $workflow, User $actor, ?string $note, array $payload): Workflow
    {
        $title = $payload['title'] ?? ('Knowledge '.$workflow->workflow_code);
        $slug = 'kb-wf-'.$workflow->id.'-'.Str::slug(Str::limit($title, 40, ''));
        $page = $this->staticPages->create([
            'title' => $title,
            'slug' => $slug,
            'content' => $payload['content'] ?? ($note ?: $workflow->description ?: 'Draft knowledge.'),
            'status' => 'draft',
        ]);

        $this->engine->recordAction(
            $workflow,
            $actor,
            'create_knowledge_draft',
            'Knowledge draft dibuat',
            ['static_page_id' => $page->id, 'slug' => $page->slug],
            ['knowledge_draft_id' => $page->id]
        );

        return $workflow->fresh($this->engine->defaultRelations());
    }

    protected function marketingAnnouncementDraft(Workflow $workflow, User $actor, ?string $note, array $payload): Workflow
    {
        // Use repository directly — avoids MarketingAnnouncementAction CmsSync publish.
        $row = $this->marketing->createAnnouncement([
            'title' => $payload['title'] ?? ('[DRAFT] '.$workflow->title),
            'message' => $payload['message'] ?? ($note ?: $workflow->description ?: 'Draft announcement'),
            'type' => 'announcement',
            'is_active' => false,
        ]);

        $this->engine->recordAction(
            $workflow,
            $actor,
            'create_announcement_draft',
            'Announcement draft dibuat (inactive)',
            ['announcement_id' => $row->id, 'is_active' => false],
            ['announcement_draft_id' => $row->id]
        );

        return $workflow->fresh($this->engine->defaultRelations());
    }

    protected function marketingDeepLink(Workflow $workflow, User $actor, string $action, ?string $note): Workflow
    {
        $links = [
            'create_banner' => '/dashboard/marketing/banners',
            'update_homepage' => '/dashboard/marketing/website/homepage-builder',
            'update_knowledge' => '/dashboard/customer-support/knowledge-base',
        ];

        $this->engine->recordAction(
            $workflow,
            $actor,
            $action,
            $note ?: ('Deep-link CMS: '.$action.' (tanpa auto-publish)'),
            [
                'deep_link' => $links[$action] ?? null,
                'auto_publish' => false,
            ],
            ['cms_deep_link' => $links[$action] ?? null]
        );

        return $workflow->fresh($this->engine->defaultRelations());
    }

    protected function resolve(Workflow $workflow, User $actor, ?string $note): Workflow
    {
        return $this->engine->transitionStatus($workflow, $actor, 'resolved', $note ?: 'Resolved', 'resolved', 'resolve');
    }

    protected function reject(Workflow $workflow, User $actor, ?string $note): Workflow
    {
        if ($workflow->current_division === 'finance') {
            app(\App\Services\Finance\FinanceLedgerService::class)->record([
                'workflow_id' => $workflow->id,
                'user_id' => $workflow->transaction?->user_id,
                'transaction_id' => $workflow->transaction_id,
                'invoice' => $workflow->transaction?->invoice_number,
                'source_module' => 'workflow',
                'event_type' => 'refund_reject',
                'debit' => 0,
                'credit' => 0,
                'reference' => $note ?: 'Refund rejected',
                'created_by' => $actor->id,
                'meta' => ['workflow_code' => $workflow->workflow_code],
            ], $actor);
        }

        return $this->engine->transitionStatus($workflow, $actor, 'rejected', $note ?: 'Rejected', 'resolved', 'reject');
    }

    protected function escalateAdmin(Workflow $workflow, User $actor, ?string $note): Workflow
    {
        return $this->engine->escalate($workflow, $actor, 'admin', $note ?: 'Escalate ke Admin');
    }

    protected function assertCanAct(Workflow $workflow, User $actor, string $action): void
    {
        $role = $actor->role instanceof UserRole ? $actor->role->value : (string) $actor->role;

        if (in_array($role, [UserRole::OWNER->value, UserRole::SUPER_ADMIN->value], true)) {
            return;
        }

        $opsActions = ['retry', 'provider_retry', 'sku_disable', 'sku_enable', 'maintenance', 'need_refund', 'resolve', 'create_sop', 'escalate_admin'];
        $financeActions = ['approve', 'full_refund', 'partial_refund', 'reject', 'need_investigation', 'escalate_admin'];
        $marketingActions = [
            'create_faq_draft', 'create_knowledge_draft', 'create_announcement_draft',
            'create_banner', 'update_homepage', 'update_knowledge', 'resolve', 'reject', 'escalate_admin',
        ];

        if ($role === UserRole::OPERATIONS->value) {
            if (! in_array($action, $opsActions, true) || $workflow->current_division !== 'operations') {
                abort(403, 'Operations hanya dapat aksi pada Issue Queue sendiri.');
            }

            return;
        }

        if ($role === UserRole::FINANCE->value) {
            if (! in_array($action, $financeActions, true) || $workflow->current_division !== 'finance') {
                abort(403, 'Finance hanya dapat aksi pada Refund Queue sendiri.');
            }

            return;
        }

        if ($role === UserRole::MARKETING->value) {
            if (! in_array($action, $marketingActions, true) || $workflow->current_division !== 'marketing') {
                abort(403, 'Marketing hanya dapat aksi pada Feedback Queue sendiri.');
            }

            return;
        }

        // CS: no approve / sku / refund
        if ($role === UserRole::CUSTOMER_SUPPORT->value) {
            abort(403, 'Customer Support tidak dapat menjalankan aksi Back Office.');
        }

        abort(403, 'Tidak berwenang.');
    }
}
