<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Models\Faq;
use App\Models\StaticPage;
use App\Models\WebsiteSetting;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;

/**
 * Account Center CMS content — FAQ, help contacts, privacy, terms, about.
 */
class AccountContentController extends Controller
{
    use ApiResponseTrait;

    public function help(): JsonResponse
    {
        $settings = WebsiteSetting::query()->pluck('value', 'key');
        $faqs = Faq::query()->orderBy('order')->orderBy('id')->get(['id', 'question', 'answer', 'order']);

        return $this->successResponse('Help Center berhasil dimuat.', [
            'faq' => $faqs->map(fn (Faq $f) => [
                'id' => $f->id,
                'question' => $f->question,
                'answer' => $f->answer,
            ])->all(),
            'whatsapp' => $settings['support_whatsapp'] ?? $settings['whatsapp'] ?? null,
            'telegram' => $settings['support_telegram'] ?? $settings['telegram'] ?? null,
            'email' => $settings['support_email'] ?? $settings['contact_email'] ?? null,
            'phone' => $settings['support_phone'] ?? $settings['contact_phone'] ?? null,
            'operatingHours' => $settings['operating_hours'] ?? $settings['support_hours'] ?? null,
            'contact' => $settings['contact_address'] ?? null,
        ]);
    }

    public function privacy(): JsonResponse
    {
        return $this->staticPageResponse('privacy-policy', 'Privacy Policy berhasil dimuat.');
    }

    public function terms(): JsonResponse
    {
        return $this->staticPageResponse('terms-conditions', 'Syarat & Ketentuan berhasil dimuat.');
    }

    public function about(): JsonResponse
    {
        $page = StaticPage::query()->where('slug', 'about-us')->first();
        $settings = WebsiteSetting::query()->pluck('value', 'key');

        return $this->successResponse('About berhasil dimuat.', [
            'title' => $page?->title ?? (config('app.name') ?: 'GurkyNet'),
            'content' => $page?->content ?? '',
            'appName' => $settings['app_name'] ?? config('app.name'),
            'version' => $settings['app_version'] ?? config('app.version', config('app.env') === 'production' ? '1.0.0' : 'dev'),
            'buildNumber' => $settings['build_number'] ?? config('app.build', null),
            'developer' => $settings['developer'] ?? $settings['company_name'] ?? null,
            'website' => $settings['website_url'] ?? $settings['site_url'] ?? null,
            'email' => $settings['support_email'] ?? $settings['contact_email'] ?? null,
        ]);
    }

    protected function staticPageResponse(string $slug, string $message): JsonResponse
    {
        $page = StaticPage::query()->where('slug', $slug)->first();
        if (!$page) {
            return $this->errorResponse('Halaman tidak ditemukan.', 404);
        }

        return $this->successResponse($message, [
            'slug' => $page->slug,
            'title' => $page->title,
            'content' => $page->content,
            'updatedAt' => $page->updated_at?->toIso8601String(),
        ]);
    }
}
