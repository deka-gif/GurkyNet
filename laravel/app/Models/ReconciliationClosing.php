<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** SRS 18.1 — daily closing snapshot. */
class ReconciliationClosing extends Model
{
    protected $fillable = [
        'closing_date',
        'summary',
        'email_sent',
    ];

    protected $casts = [
        'closing_date' => 'date',
        'summary' => 'array',
        'email_sent' => 'boolean',
    ];
}
