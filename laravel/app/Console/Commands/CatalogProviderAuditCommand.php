<?php

namespace App\Console\Commands;

use App\Services\Catalog\CatalogProviderAuditService;
use Illuminate\Console\Command;

class CatalogProviderAuditCommand extends Command
{
    protected $signature = 'catalog:provider-audit
                            {--category= : Filter by category slug (comma-separated)}
                            {--samples=3 : Sample rows per category}';

    protected $description = 'Read-only audit: provider mapping coverage, duplicates, and purchasability per category.';

    public function handle(CatalogProviderAuditService $audit): int
    {
        $categoryOpt = trim((string) $this->option('category'));
        $categories = $categoryOpt !== '' ? array_map('trim', explode(',', $categoryOpt)) : null;
        $samples = max(0, (int) $this->option('samples'));

        $report = $audit->summarize($categories);

        $this->info('=== Catalog Provider Audit (read-only) ===');
        $this->line('Generated: '.$report['generated_at']);
        $this->newLine();

        $s = $report['summary'];
        $this->table(['Metric', 'Count'], [
            ['Active products', $s['total_active']],
            ['Digiflazz only', $s['digiflazz_only']],
            ['VIPayment only', $s['vip_only']],
            ['Both providers', $s['both_providers']],
            ['No provider mapping', $s['no_mapping']],
            ['Invalid mapping (empty SKU)', $s['invalid_mapping']],
            ['Purchasable now', $s['purchasable']],
            ['Likely duplicate groups (same LogicalProductKey)', $s['likely_duplicate_groups']],
        ]);

        $this->newLine();
        $this->info('=== Per category ===');
        $rows = [];
        foreach ($report['by_category'] as $slug => $cat) {
            $rows[] = [
                $slug,
                $cat['active'],
                $cat['digiflazz_only'],
                $cat['vip_only'],
                $cat['both_providers'],
                $cat['no_mapping'],
                $cat['duplicate_group_keys'],
                $cat['purchasable'],
            ];
        }
        $this->table(
            ['Category', 'Active', 'Digi only', 'VIP only', 'Both', 'No map', 'Dup groups', 'Purchasable'],
            $rows
        );

        if ($samples > 0) {
            $this->newLine();
            $this->info('=== Samples ===');
            foreach (array_keys($report['by_category']) as $slug) {
                $this->line(strtoupper($slug));
                foreach ($audit->sampleProducts($slug, $samples) as $row) {
                    $this->line(sprintf(
                        '  %s — Digi: %s | VIP: %s | %s | %s',
                        $row['name'],
                        $row['digiflazz'],
                        $row['vipayment'],
                        $row['result'],
                        json_encode($row['routing'], JSON_UNESCAPED_UNICODE)
                    ));
                }
                $this->newLine();
            }
        }

        return self::SUCCESS;
    }
}
