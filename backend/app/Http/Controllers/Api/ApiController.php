<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Pagination\LengthAwarePaginator;

class ApiController extends Controller
{
    /**
     * Return a standardized JSON success response.
     */
    protected function successResponse($data = null, string $message = 'Success', int $statusCode = 200, array $meta = []): JsonResponse
    {
        $payload = [
            'success' => true,
            'message' => $message,
            'data' => $data,
            'meta' => array_merge([
                'timestamp' => now()->toIso8601String(),
                'version' => 'v1',
            ], $meta),
        ];

        return response()->json($payload, $statusCode);
    }

    /**
     * Return a standardized JSON error response.
     */
    protected function errorResponse(string $message, string $errorCode = 'ERROR', int $statusCode = 400, $details = []): JsonResponse
    {
        $payload = [
            'success' => false,
            'error' => [
                'code' => $errorCode,
                'message' => $message,
                'details' => $details,
            ],
            'meta' => [
                'timestamp' => now()->toIso8601String(),
                'version' => 'v1',
            ],
        ];

        return response()->json($payload, $statusCode);
    }

    /**
     * Alias for successResponse.
     */
    protected function success($data = null, string $message = 'Success', int $statusCode = 200, array $meta = []): JsonResponse
    {
        return $this->successResponse($data, $message, $statusCode, $meta);
    }

    /**
     * Alias for errorResponse supporting both ($msg, $statusCode) and ($msg, $errorCode, $statusCode).
     */
    protected function error(string $message, string|int $errorCodeOrStatus = 'ERROR', int $statusCode = 400, $details = []): JsonResponse
    {
        if (is_int($errorCodeOrStatus)) {
            $statusCode = $errorCodeOrStatus;
            $errorCode = match ($statusCode) {
                400 => 'BAD_REQUEST',
                401 => 'UNAUTHORIZED',
                403 => 'FORBIDDEN',
                404 => 'NOT_FOUND',
                410 => 'GONE',
                422 => 'UNPROCESSABLE_ENTITY',
                423 => 'LOCKED',
                default => 'ERROR',
            };
        } else {
            $errorCode = $errorCodeOrStatus;
        }

        return $this->errorResponse($message, $errorCode, $statusCode, $details);
    }

    /**
     * Return a standardized paginated response.
     */
    protected function paginatedResponse(LengthAwarePaginator $paginator, string $message = 'Success', $resourceCallback = null): JsonResponse
    {
        $items = $resourceCallback ? $paginator->getCollection()->map($resourceCallback) : $paginator->items();

        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $items,
            'meta' => [
                'timestamp' => now()->toIso8601String(),
                'version' => 'v1',
                'pagination' => [
                    'current_page' => $paginator->currentPage(),
                    'per_page' => $paginator->perPage(),
                    'total_items' => $paginator->total(),
                    'total_pages' => $paginator->lastPage(),
                    'has_more' => $paginator->hasMorePages(),
                ],
            ],
        ], 200);
    }
}
