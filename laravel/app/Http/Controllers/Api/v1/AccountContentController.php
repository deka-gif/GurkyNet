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
        $settings = WebsiteSetting::query()->first();
        $faqs = Faq::query()->orderBy('order')->orderBy('id')->get(['id', 'question', 'answer', 'order']);

        return $this->successResponse('Help Center berhasil dimuat.', [
            'faq' => $faqs->map(fn (Faq $f) => [
                'id' => $f->id,
                'question' => $f->question,
                'answer' => $f->answer,
            ])->all(),
            'whatsapp' => $settings?->whatsapp,
            'telegram' => null,
            'email' => $settings?->support_email,
            'phone' => $settings?->support_phone,
            'operatingHours' => $settings?->operating_hours, // FR-MKT01
            'contact' => $settings?->office_address,
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
        $settings = WebsiteSetting::query()->first();

        return $this->successResponse('About berhasil dimuat.', [
            'title' => $page?->title ?? (config('app.name') ?: 'GurkyNet'),
            'content' => $page?->content ?? '',
            'appName' => $settings?->website_name ?? config('app.name'),
            'version' => config('app.version', config('app.env') === 'production' ? '1.0.0' : 'dev'),
            'buildNumber' => config('app.build', null),
            'developer' => null,
            'website' => config('app.url'),
            'email' => $settings?->support_email,
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
