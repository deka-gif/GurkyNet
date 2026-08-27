<?php

namespace App\Http\Controllers\Api\v1\Partner;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

/** FR-API-10 — OpenAPI document for Partner H2H (actual routes only). */
class PartnerOpenApiController extends Controller
{
    public function __invoke(): JsonResponse
    {
        return response()->json([
            'openapi' => '3.0.3',
            'info' => [
                'title' => 'GurkyNet Partner H2H API',
                'version' => '1.0.0',
                'description' => 'SRS Bagian 30 — Mitra/Reseller API. Signature: HMAC-SHA256(request body, API Secret). Headers: X-API-Key, X-Signature, X-Timestamp (unix, ±5 minutes).',
            ],
            'servers' => [['url' => '/api/v1/partner']],
            'components' => [
                'securitySchemes' => [
                    'PartnerHmac' => [
                        'type' => 'apiKey',
                        'in' => 'header',
                        'name' => 'X-API-Key',
                        'description' => 'Also send X-Signature = HMAC-SHA256(raw body, secret) and X-Timestamp',
                    ],
                ],
            ],
            'security' => [['PartnerHmac' => []]],
            'paths' => [
                '/price' => [
                    'get' => [
                        'summary' => 'FR-API-04 Price/stock inquiry',
                        'parameters' => [
                            ['name' => 'sku_code', 'in' => 'query', 'schema' => ['type' => 'string']],
                        ],
                        'responses' => ['200' => ['description' => 'OK'], '401' => ['description' => 'Unauthorized'], '429' => ['description' => 'Rate limited']],
                    ],
                ],
                '/execute' => [
                    'post' => [
                        'summary' => 'FR-API-05 Execute transaction (idempotency_key required)',
                        'requestBody' => [
                            'required' => true,
                            'content' => [
                                'application/json' => [
                                    'schema' => [
                                        'type' => 'object',
                                        'required' => ['sku_code', 'target_number', 'partner_ref', 'idempotency_key'],
                                        'properties' => [
                                            'sku_code' => ['type' => 'string'],
                                            'target_number' => ['type' => 'string'],
                                            'partner_ref' => ['type' => 'string'],
                                            'idempotency_key' => ['type' => 'string'],
                                        ],
                                    ],
                                ],
                            ],
                        ],
                        'responses' => [
                            '201' => ['description' => 'Created'],
                            '200' => ['description' => 'Idempotent replay'],
                            '401' => ['description' => 'Unauthorized'],
                            '422' => ['description' => 'Validation / payload mismatch'],
                            '429' => ['description' => 'Rate limited'],
                        ],
                    ],
                ],
                '/status' => [
                    'get' => [
                        'summary' => 'FR-API-06 Status by partner_ref',
                        'parameters' => [
                            ['name' => 'partner_ref', 'in' => 'query', 'required' => true, 'schema' => ['type' => 'string']],
                        ],
                        'responses' => ['200' => ['description' => 'OK'], '404' => ['description' => 'Not found']],
                    ],
                ],
            ],
            'x-webhook' => [
                'description' => 'FR-API-07 Signed POST to partner callback_url; retries 1m/5m/30m max 3',
            ],
            'x-sandbox' => [
                'description' => 'Sandbox credentials (is_sandbox=true): no real partner wallet debit, no provider fulfill, no financial webhook effects',
            ],
            'x-errors' => [
                '401' => 'invalid key / signature / timestamp / replay',
                '403' => 'partner not approved / IP whitelist',
                '429' => 'per-partner rate limit (default 60/min)',
            ],
        ]);
    }
}
