<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** FR-FIN-07 / 18.1 — gateway & provider daily recon rows. */
class GatewayReconciliationItem extends Model
{
    protected $fillable = [
        'recon_date',
        'source',
        'external_reference',
        'external_amount',
        'internal_amount',
        'variance',
        'match_status',
        'internal_type',
        'internal_id',
        'evidence',
        'matched_by',
        'matched_at',
        'reconciliation_incident_id',
        'meta',
    ];

    protected $casts = [
        'recon_date' => 'date',
        'external_amount' => 'decimal:2',
        'internal_amount' => 'decimal:2',
        'variance' => 'decimal:2',
        'matched_at' => 'datetime',
        'meta' => 'array',
    ];
}
