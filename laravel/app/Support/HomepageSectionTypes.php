<?php

namespace App\Support;

final class HomepageSectionTypes
{
    /**
     * @return list<string>
     */
    public static function all(): array
    {
        return [
            'hero',
            'banner',
            'promo',
            'features',
            'categories',
            'product_grid',
            'statistics',
            'why_us',
            'partners',
            'testimonials',
            'how_it_works',
            'announcement',
            'news',
            'faq',
            'cta',
            'footer',
            'seo',
        ];
    }

    public static function validationRule(): string
    {
        return 'in:'.implode(',', self::all());
    }
}
