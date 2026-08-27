<?php

namespace App\Services\Sla;

use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;

/**
 * Sprint 18 — business hours abstraction (SRS Bagian 23 deposit in/out hours).
 * Hours/timezone are config defaults — Owner calendar confirmation still FINDING.
 */
class BusinessHoursService
{
    public function timezone(): string
    {
        return (string) config('sla.timezone', 'Asia/Jakarta');
    }

    public function isWithinBusinessHours(?CarbonInterface $at = null): bool
    {
        $at = ($at ?? now())->copy()->timezone($this->timezone());
        $weekdays = config('sla.business_hours.weekdays', [1, 2, 3, 4, 5]);
        if (! in_array((int) $at->dayOfWeekIso, $weekdays, true)) {
            return false;
        }

        $start = Carbon::parse($at->toDateString().' '.config('sla.business_hours.start', '09:00'), $this->timezone());
        $end = Carbon::parse($at->toDateString().' '.config('sla.business_hours.end', '17:00'), $this->timezone());

        return $at->betweenIncluded($start, $end);
    }
}
