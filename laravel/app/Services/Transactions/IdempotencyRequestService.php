<?php

namespace App\Services\Transactions;

use App\Models\IdempotencyRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Throwable;

/**
 * SRS 14.1 — idempotency_requests is SOURCE OF TRUTH.
 * Replay returns response_snapshot; payload mismatch rejected; TTL 24h then archive (not hard delete).
 *
 * Lock is NOT held across the business operation (avoids blocking Midtrans/provider I/O).
 */
class IdempotencyRequestService
{
    public const TTL_HOURS = 24;

    public const STALE_PROCESSING_MINUTES = 2;

    /**
     * @param  callable(): array{result?: mixed, snapshot: array, http_status?: int}|mixed  $operation
     * @return array{replay: bool, result: mixed, snapshot: ?array, http_status: int}
     */
    public function run(
        ?int $userId,
        string $key,
        string $endpoint,
        array $payload,
        callable $operation
    ): array {
        $hash = $this->hashPayload($payload);

        $claim = $this->claimOrReplay($userId, $key, $endpoint, $hash);
        if ($claim['replay']) {
            return [
                'replay' => true,
                'result' => $claim['snapshot'],
                'snapshot' => $claim['snapshot'],
                'http_status' => (int) ($claim['snapshot']['http_status'] ?? 200),
            ];
        }

        /** @var IdempotencyRequest $row */
        $row = $claim['row'];

        try {
            $raw = $operation();
        } catch (Throwable $e) {
            $this->markFailed($row);
            throw $e;
        }

        if (is_array($raw) && array_key_exists('snapshot', $raw)) {
            $snapshot = is_array($raw['snapshot']) ? $raw['snapshot'] : ['data' => $raw['snapshot']];
            $httpStatus = (int) ($raw['http_status'] ?? 200);
            $result = $raw['result'] ?? $raw['snapshot'];
        } else {
            $snapshot = ['data' => $raw];
            $httpStatus = 200;
            $result = $raw;
        }

        $snapshot['http_status'] = $httpStatus;
        $this->markCompleted($row, $snapshot);

        return [
            'replay' => false,
            'result' => $result,
            'snapshot' => $snapshot,
            'http_status' => $httpStatus,
        ];
    }

    /**
     * @return array{replay: true, snapshot: array}|array{replay: false, row: IdempotencyRequest}
     */
    protected function claimOrReplay(?int $userId, string $key, string $endpoint, string $hash): array
    {
        return DB::transaction(function () use ($userId, $key, $endpoint, $hash) {
            $existing = IdempotencyRequest::query()
                ->where('key', $key)
                ->where('endpoint', $endpoint)
                ->lockForUpdate()
                ->first();

            if ($existing && $this->isExpired($existing)) {
                $this->archiveInPlace($existing);
                $existing = null;
            }

            if ($existing) {
                if (!hash_equals((string) $existing->request_hash, $hash)) {
                    throw ValidationException::withMessages([
                        'idempotency_key' => ['Idempotency key reused with a different request payload.'],
                    ]);
                }

                if ($existing->status === IdempotencyRequest::STATUS_COMPLETED) {
                    return [
                        'replay' => true,
                        'snapshot' => is_array($existing->response_snapshot)
                            ? $existing->response_snapshot
                            : [],
                    ];
                }

                if ($existing->status === IdempotencyRequest::STATUS_PROCESSING) {
                    if ($existing->created_at && $existing->created_at->lt(now()->subMinutes(self::STALE_PROCESSING_MINUTES))) {
                        // Stale claim after crash — free the unique slot via key rotation, then reclaim.
                        $this->rotateKey($existing, 'stale');
                    } else {
                        throw new ConflictHttpException('A request with this idempotency key is already in progress.');
                    }
                }

                if (in_array($existing->status, [
                    IdempotencyRequest::STATUS_FAILED,
                    IdempotencyRequest::STATUS_ARCHIVED,
                ], true)) {
                    $this->rotateKey($existing, $existing->status);
                }
            }

            $row = IdempotencyRequest::create([
                'user_id' => $userId,
                'key' => $key,
                'endpoint' => $endpoint,
                'request_hash' => $hash,
                'response_snapshot' => null,
                'status' => IdempotencyRequest::STATUS_PROCESSING,
                'created_at' => now(),
            ]);

            return ['replay' => false, 'row' => $row];
        });
    }

    protected function markCompleted(IdempotencyRequest $row, array $snapshot): void
    {
        DB::transaction(function () use ($row, $snapshot) {
            $locked = IdempotencyRequest::query()->where('id', $row->id)->lockForUpdate()->first();
            if (!$locked || $locked->status === IdempotencyRequest::STATUS_COMPLETED) {
                return;
            }
            $locked->response_snapshot = $snapshot;
            $locked->status = IdempotencyRequest::STATUS_COMPLETED;
            $locked->completed_at = now();
            $locked->save();
        });
    }

    protected function markFailed(IdempotencyRequest $row): void
    {
        DB::transaction(function () use ($row) {
            $locked = IdempotencyRequest::query()->where('id', $row->id)->lockForUpdate()->first();
            if (!$locked || $locked->status === IdempotencyRequest::STATUS_COMPLETED) {
                return;
            }
            $locked->status = IdempotencyRequest::STATUS_FAILED;
            $locked->completed_at = now();
            $locked->save();
        });
    }

    protected function isExpired(IdempotencyRequest $row): bool
    {
        if ($row->status === IdempotencyRequest::STATUS_ARCHIVED || $row->archived_at) {
            return true;
        }

        return $row->created_at !== null && $row->created_at->lt(now()->subHours(self::TTL_HOURS));
    }

    /**
     * Archive without hard delete (SRS 14.1). Rotates key so the unique (key, endpoint)
     * slot can be reused after TTL.
     */
    protected function archiveInPlace(IdempotencyRequest $row): void
    {
        $row->status = IdempotencyRequest::STATUS_ARCHIVED;
        $row->archived_at = now();
        $row->key = $row->key.'#archived#'.$row->id;
        $row->save();
    }

    protected function rotateKey(IdempotencyRequest $row, string $reason): void
    {
        if ($row->status !== IdempotencyRequest::STATUS_ARCHIVED) {
            // Keep failed/stale rows for audit; free the unique slot.
            if ($row->status === IdempotencyRequest::STATUS_PROCESSING) {
                $row->status = IdempotencyRequest::STATUS_FAILED;
                $row->completed_at = now();
            }
        }
        $row->key = $row->key.'#'.$reason.'#'.$row->id;
        $row->save();
    }

    public function hashPayload(array $payload): string
    {
        $normalized = $payload;
        unset($normalized['idempotency_key'], $normalized['Idempotency-Key']);
        ksort($normalized);

        return hash('sha256', json_encode($normalized, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '');
    }

    /**
     * SRS 14.1 — archive rows older than 24h (not hard delete).
     */
    public function archiveExpired(): int
    {
        $cutoff = now()->subHours(self::TTL_HOURS);
        $count = 0;

        IdempotencyRequest::query()
            ->whereNull('archived_at')
            ->where('status', '!=', IdempotencyRequest::STATUS_ARCHIVED)
            ->where('created_at', '<', $cutoff)
            ->orderBy('id')
            ->chunkById(100, function ($rows) use (&$count) {
                foreach ($rows as $row) {
                    $this->archiveInPlace($row);
                    $count++;
                }
            });

        return $count;
    }
}
