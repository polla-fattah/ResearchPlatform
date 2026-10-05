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
    protected function errorResponse(string $message, string|int $errorCode = 'ERROR', int|array $statusCode = 400, $details = []): JsonResponse
    {
        if (is_int($errorCode)) {
            $actualStatusCode = $errorCode;
            $actualErrorCode = match ($actualStatusCode) {
                400 => 'BAD_REQUEST',
                401 => 'UNAUTHENTICATED',
                403 => 'FORBIDDEN',
                404 => 'NOT_FOUND',
                409 => 'CONFLICT',
                410 => 'GONE',
                422 => 'VALIDATION_ERROR',
                423 => 'LOCKED',
                429 => 'RATE_LIMITED',
                default => 'ERROR',
            };
            $actualDetails = is_array($statusCode) ? $statusCode : $details;
        } else {
            $actualErrorCode = $errorCode;
            $actualStatusCode = is_int($statusCode) ? $statusCode : 400;
            $actualDetails = is_array($details) ? $details : (is_array($statusCode) ? $statusCode : []);
        }

        $payload = [
            'success' => false,
            'error' => [
                'code' => $actualErrorCode,
                'message' => $message,
                'details' => $actualDetails,
            ],
            'meta' => [
                'timestamp' => now()->toIso8601String(),
                'version' => 'v1',
            ],
        ];

        return response()->json($payload, $actualStatusCode);
    }

    /**
     * Alias for successResponse.
     */
    protected function success($data = null, string $message = 'Success', int $statusCode = 200, array $meta = []): JsonResponse
    {
        return $this->successResponse($data, $message, $statusCode, $meta);
    }

    /**
     * Alias for errorResponse supporting both ($msg, $statusCode, $details) and ($msg, $errorCode, $statusCode, $details).
     */
    protected function error(string $message, string|int $errorCodeOrStatus = 'ERROR', int|array $statusCodeOrDetails = 400, $details = []): JsonResponse
    {
        if (is_int($errorCodeOrStatus)) {
            $actualStatusCode = $errorCodeOrStatus;
            $actualErrorCode = match ($actualStatusCode) {
                400 => 'BAD_REQUEST',
                401 => 'UNAUTHENTICATED',
                403 => 'FORBIDDEN',
                404 => 'NOT_FOUND',
                409 => 'CONFLICT',
                410 => 'GONE',
                422 => 'VALIDATION_ERROR',
                423 => 'LOCKED',
                429 => 'RATE_LIMITED',
                default => 'ERROR',
            };
            $actualDetails = is_array($statusCodeOrDetails) ? $statusCodeOrDetails : $details;
            return $this->errorResponse($message, $actualErrorCode, $actualStatusCode, $actualDetails);
        }

        $actualStatusCode = is_int($statusCodeOrDetails) ? $statusCodeOrDetails : 400;
        $actualDetails = is_array($details) ? $details : (is_array($statusCodeOrDetails) ? $statusCodeOrDetails : []);
        return $this->errorResponse($message, $errorCodeOrStatus, $actualStatusCode, $actualDetails);
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
