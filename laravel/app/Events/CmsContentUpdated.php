<?php

namespace App\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Fired whenever Marketing CMS mutates public content.
 * Frontend discovers changes via GET /public/cms-sync revision polling
 * (Reverb/Echo can subscribe later without changing this contract).
 */
class CmsContentUpdated
{
    use Dispatchable;
    use SerializesModels;

    /**
     * @param  list<string>  $scopes
     */
    public function __construct(
        public int $revision,
        public array $scopes = [],
        public ?string $reason = null,
    ) {}
}
