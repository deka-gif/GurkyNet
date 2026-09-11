<?php

namespace App\Support;

/**
 * Titles/prefix for Cek Wilayah Kartu FAQ articles (mobile + CS KB).
 * Kept in sync with mobile help.service / cek-zona.
 */
final class CekWilayahKartuFaq
{
    public const TITLE_PREFIX = 'Cek Wilayah Kartu — ';

    /** @return list<string> */
    public static function providerSlugs(): array
    {
        return ['telkomsel', 'indosat', 'tri', 'axis', 'xl', 'smartfren'];
    }

    public static function titleFor(string $providerSlug): string
    {
        $labels = [
            'telkomsel' => 'Telkomsel',
            'indosat' => 'Indosat',
            'tri' => 'Tri',
            'axis' => 'Axis',
            'xl' => 'XL',
            'smartfren' => 'Smartfren',
        ];
        $label = $labels[strtolower($providerSlug)] ?? ucfirst($providerSlug);

        return self::TITLE_PREFIX.$label;
    }

    public static function isCekWilayahQuestion(string $question): bool
    {
        return str_starts_with($question, self::TITLE_PREFIX);
    }

    public static function providerFromQuestion(string $question): ?string
    {
        if (! self::isCekWilayahQuestion($question)) {
            return null;
        }
        $label = trim(substr($question, strlen(self::TITLE_PREFIX)));
        $map = [
            'Telkomsel' => 'telkomsel',
            'Indosat' => 'indosat',
            'Tri' => 'tri',
            'Axis' => 'axis',
            'XL' => 'xl',
            'Smartfren' => 'smartfren',
        ];

        return $map[$label] ?? null;
    }
}
