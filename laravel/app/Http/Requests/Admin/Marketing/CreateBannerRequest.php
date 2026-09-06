<?php

namespace App\Http\Requests\Admin\Marketing;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CreateBannerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $redirect = $this->input('redirect_url')
            ?? $this->input('cta_url')
            ?? $this->input('link_url')
            ?? $this->input('clickUrl');

        $starts = $this->input('starts_at') ?? $this->input('start_date');
        $ends = $this->input('ends_at') ?? $this->input('end_date');
        $code = $this->input('code') ?? $this->input('promo_code') ?? $this->input('promoCode');
        $ctaLabel = $this->input('cta_label') ?? $this->input('ctaLabel');
        $sortOrder = $this->input('sort_order') ?? $this->input('sortOrder');
        $terms = $this->input('terms') ?? $this->input('terms_and_conditions');

        $this->merge(array_filter([
            'redirect_url' => $redirect,
            'starts_at' => $starts,
            'ends_at' => $ends,
            'code' => $code,
            'cta_label' => $ctaLabel,
            'sort_order' => $sortOrder,
            'terms' => $terms,
        ], fn ($v) => $v !== null && $v !== ''));

        if ($this->input('image_url') === '') {
            $this->merge(['image_url' => null]);
        }
    }

    public function rules(): array
    {
        return [
            'title' => 'required|string|max:255',
            // Soft-deleted slugs are allowed past validation; repository suffixes via
            // makeUniqueSlug so the global unique index never causes SQL 500.
            'slug' => [
                'nullable',
                'string',
                'max:191',
                'alpha_dash',
                Rule::unique('banner_promotions', 'slug')->whereNull('deleted_at'),
            ],
            'code' => 'nullable|string|max:64',
            'description' => 'nullable|string|max:5000',
            'terms' => 'nullable|string|max:20000',
            // DB image_url is NOT NULL. Accept desktop URL/media OR mobile media (hydrate fills image_url).
            'image_url' => 'nullable|string|max:255|required_without_all:image_media_id,mobile_image_media_id',
            'image_media_id' => 'nullable|integer|exists:media,id',
            'mobile_image_media_id' => 'nullable|integer|exists:media,id',
            'redirect_url' => 'nullable|string|max:500',
            'cta_label' => 'nullable|string|max:120',
            'starts_at' => 'nullable|date',
            'ends_at' => 'nullable|date|after_or_equal:starts_at',
            'priority' => 'nullable|integer|min:0|max:9999',
            'sort_order' => 'nullable|integer|min:0|max:999999',
            'is_active' => 'nullable|boolean',
        ];
    }
}
