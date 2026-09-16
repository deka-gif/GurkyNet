<?php

namespace App\Console\Commands;

use App\Services\Website\PublicHomepagePayloadBuilder;
use Illuminate\Console\Command;

/**
 * Paket Q (Masalah 1) — keep PublicHomepageCache warm before TTL 300s expires.
 */
class WarmPublicHomepageCommand extends Command
{
    protected $signature = 'website:warm-public-homepage';

    protected $description = 'Force-rebuild public homepage cache (settings/menus/catalog aggregate) and log duration';

    public function handle(PublicHomepagePayloadBuilder $builder): int
    {
        $result = $builder->warm();
        $ms = $result['duration_ms'];
        $this->info("Public homepage cache warmed in {$ms} ms.");

        return self::SUCCESS;
    }
}
