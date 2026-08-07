<?php

namespace App\Http\Requests\Admin\Marketing;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateBannerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $merge = [];

        if ($this->hasAny(['redirect_url', 'cta_url', 'link_url', 'clickUrl'])) {
            $merge['redirect_url'] = $this->input('redirect_url')
                ?? $this->input('cta_url')
                ?? $this->input('link_url')
                ?? $this->input('clickUrl');
        }

        if ($this->hasAny(['starts_at', 'start_date'])) {
            $merge['starts_at'] = $this->input('starts_at') ?? $this->input('start_date');
        }

        if ($this->hasAny(['ends_at', 'end_date'])) {
            $merge['ends_at'] = $this->input('ends_at') ?? $this->input('end_date');
        }

        if ($this->hasAny(['code', 'promo_code', 'promoCode'])) {
            $merge['code'] = $this->input('code') ?? $this->input('promo_code') ?? $this->input('promoCode');
        }

        if ($this->hasAny(['cta_label', 'ctaLabel'])) {
            $merge['cta_label'] = $this->input('cta_label') ?? $this->input('ctaLabel');
        }

        if ($this->hasAny(['sort_order', 'sortOrder'])) {
            $merge['sort_order'] = $this->input('sort_order') ?? $this->input('sortOrder');
        }

        if ($this->hasAny(['terms', 'terms_and_conditions'])) {
            $merge['terms'] = $this->input('terms') ?? $this->input('terms_and_conditions');
        }

        if ($merge !== []) {
            $this->merge($merge);
        }
    }

    public function rules(): array
    {
        $id = $this->route('id');

        return [
            'title' => 'nullable|string|max:255',
            'slug' => [
                'nullable',
                'string',
                'max:191',
                'alpha_dash',
                Rule::unique('banner_promotions', 'slug')
                    ->ignore($id)
                    ->whereNull('deleted_at'),
            ],
            'code' => 'nullable|string|max:64',
            'description' => 'nullable|string|max:5000',
            'terms' => 'nullable|string|max:20000',
            'image_url' => 'nullable|string|max:500',
            'image_media_id' => 'nullable|integer',
            'mobile_image_media_id' => 'nullable|integer',
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
