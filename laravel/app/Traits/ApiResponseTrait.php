<?php

namespace App\Traits;

use Illuminate\Http\JsonResponse;

trait ApiResponseTrait
{
    /**
     * Flatten JsonResource / ResourceCollection so clients get payload arrays, not nested {data:{data:[]}}.
     */
    protected function normalizePayload(mixed $data): mixed
    {
        if ($data instanceof \Illuminate\Http\Resources\Json\AnonymousResourceCollection
            || $data instanceof \Illuminate\Http\Resources\Json\ResourceCollection) {
            return $data->collection
                ->map(fn ($resource) => $resource instanceof \Illuminate\Http\Resources\Json\JsonResource
                    ? $resource->resolve()
                    : $resource)
                ->values()
                ->all();
        }

        if ($data instanceof \Illuminate\Http\Resources\Json\JsonResource) {
            return $data->resolve();
        }

        return $data;
    }

    /**
     * Standard success response.
     */
    protected function successResponse(string $message, mixed $data = null, int $statusCode = 200, mixed $meta = null): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $this->normalizePayload($data),
            'meta' => $meta,
            'errors' => null,
        ], $statusCode);
    }

    /**
     * Standard error response.
     */
    protected function errorResponse(string $message, int $statusCode = 400, mixed $errors = null): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => $message,
            'data' => null,
            'meta' => null,
            'errors' => $errors,
        ], $statusCode);
    }

    /**
     * Standard paginated response.
     */
    protected function paginatedResponse(string $message, mixed $data, mixed $pagination = null, int $statusCode = 200): JsonResponse
    {
        $formattedPagination = null;
        if ($pagination instanceof \Illuminate\Contracts\Pagination\LengthAwarePaginator) {
            $formattedPagination = [
                'currentPage' => $pagination->currentPage(),
                'lastPage' => $pagination->lastPage(),
                'perPage' => $pagination->perPage(),
                'total' => $pagination->total(),
            ];
        } elseif (is_array($pagination)) {
            $formattedPagination = [
                'currentPage' => (int) ($pagination['currentPage'] ?? $pagination['current_page'] ?? 1),
                'lastPage' => (int) ($pagination['lastPage'] ?? $pagination['last_page'] ?? 1),
                'perPage' => (int) ($pagination['perPage'] ?? $pagination['per_page'] ?? 15),
                'total' => (int) ($pagination['total'] ?? 0),
            ];
        }

        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $this->normalizePayload($data),
            'meta' => $formattedPagination ? ['pagination' => $formattedPagination] : null,
            'pagination' => $formattedPagination,
            'errors' => null,
        ], $statusCode);
    }
}
