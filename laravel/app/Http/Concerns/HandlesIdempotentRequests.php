<?php

namespace App\Http\Concerns;

use App\Services\Transactions\IdempotencyRequestService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * SRS 14.1 — wrap balance-mutating HTTP handlers with idempotency_requests SoT.
 */
trait HandlesIdempotentRequests
{
    /**
     * @param  callable(): array{result?: mixed, snapshot: array, http_status?: int}|mixed  $operation
     */
    protected function withIdempotency(
        Request $request,
        string $endpoint,
        array $payload,
        callable $operation,
        ?string $explicitKey = null
    ): JsonResponse {
        $key = $explicitKey ?? $request->input('idempotency_key') ?? $request->header('Idempotency-Key');
        if (!is_string($key) || trim($key) === '') {
            // Required by SRS 14.1 for balance actions — reject rather than process without key.
            return response()->json([
                'success' => false,
                'message' => 'idempotency_key wajib diisi untuk aksi yang mengubah saldo.',
                'errors' => ['idempotency_key' => ['The idempotency key field is required.']],
            ], 422);
        }

        $service = app(IdempotencyRequestService::class);
        $userId = $request->user()?->id;

        $outcome = $service->run($userId, trim($key), $endpoint, $payload, $operation);

        if ($outcome['replay']) {
            $snapshot = $outcome['snapshot'] ?? [];
            $body = $snapshot['body'] ?? $snapshot;
            $http = (int) ($outcome['http_status'] ?? $snapshot['http_status'] ?? 200);

            return response()->json($body, $http);
        }

        $result = $outcome['result'];
        if ($result instanceof JsonResponse) {
            return $result;
        }

        // Operation returned structured snapshot path already completed inside service.
        $snapshot = $outcome['snapshot'] ?? [];
        if (isset($snapshot['body']) && is_array($snapshot['body'])) {
            return response()->json($snapshot['body'], (int) ($outcome['http_status'] ?? 200));
        }

        return response()->json($result, (int) ($outcome['http_status'] ?? 200));
    }

    /**
     * Build a standard success payload + snapshot for IdempotencyRequestService.
     *
     * @param  mixed  $data
     * @return array{result: JsonResponse, snapshot: array, http_status: int}
     */
    protected function idempotentJson(string $message, mixed $data, int $status = 200): array
    {
        // Match ApiResponseTrait envelope so replays look identical to first responses.
        $body = [
            'success' => true,
            'message' => $message,
            'data' => $data,
            'meta' => null,
            'errors' => null,
        ];

        return [
            'result' => response()->json($body, $status),
            'snapshot' => ['body' => $body, 'http_status' => $status],
            'http_status' => $status,
        ];
    }

    protected function idempotencyConflictResponse(\Throwable $e): ?JsonResponse
    {
        if ($e instanceof \Symfony\Component\HttpKernel\Exception\ConflictHttpException) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
                'data' => null,
                'meta' => null,
                'errors' => null,
            ], 409);
        }

        return null;
    }
}
