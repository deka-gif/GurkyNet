# Partner Portal (FR-API-09)

**SRS:** Bagian 30 — API H2H Mitra/Reseller.

Minimal self-service API for Mitra (Sprint 17):

| Endpoint | Purpose |
|----------|---------|
| `POST /api/v1/partner-portal/apply` | FR-API-01 application |
| `GET /api/v1/partner-portal/me` | Approval status + wallet balance |
| `GET /api/v1/partner-portal/credentials` | API key metadata (no secret) |
| `POST .../credentials/{id}/rotate` | FR-API-11 rotate (secret once) |
| `POST .../credentials/{id}/revoke` | FR-API-11 revoke |
| `GET /api/v1/partner-portal/logs` | Own request logs |
| `GET /api/v1/partner-portal/transactions` | Own partner_api transactions |
| `POST/GET /api/v1/partner-portal/deposits` | Manual deposit request |
| `GET /api/v1/partner-portal/docs` | Link to OpenAPI |

H2H machine API: `/api/v1/partner/price|execute|status` (HMAC).

OpenAPI: `/api/v1/partner/openapi.json`

Auth for portal: Sanctum (same user bound to `api_partners.user_id`).
