<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'approved' => \App\Http\Middleware\EnsureAccountApproved::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        $exceptions->render(function (\Illuminate\Auth\AuthenticationException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'success' => false,
                    'error' => [
                        'code' => 'UNAUTHENTICATED',
                        'message' => 'Unauthenticated.',
                        'details' => [],
                    ],
                    'meta' => [
                        'timestamp' => now()->toIso8601String(),
                        'version' => 'v1',
                    ],
                ], 401);
            }
        });

        $exceptions->render(function (\Illuminate\Validation\ValidationException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => $e->getMessage(),
                    'error' => [
                        'code' => 'VALIDATION_ERROR',
                        'message' => $e->getMessage(),
                        'details' => $e->errors(),
                    ],
                    'errors' => $e->errors(),
                    'meta' => [
                        'timestamp' => now()->toIso8601String(),
                        'version' => 'v1',
                    ],
                ], 422);
            }
        });

        $exceptions->render(function (\Illuminate\Auth\Access\AuthorizationException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'success' => false,
                    'error' => [
                        'code' => 'FORBIDDEN',
                        'message' => $e->getMessage() ?: 'This action is unauthorized.',
                        'details' => [],
                    ],
                    'meta' => [
                        'timestamp' => now()->toIso8601String(),
                        'version' => 'v1',
                    ],
                ], 403);
            }
        });

        $exceptions->render(function (\Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'success' => false,
                    'error' => [
                        'code' => 'FORBIDDEN',
                        'message' => $e->getMessage() ?: 'This action is unauthorized.',
                        'details' => [],
                    ],
                    'meta' => [
                        'timestamp' => now()->toIso8601String(),
                        'version' => 'v1',
                    ],
                ], 403);
            }
        });

        $exceptions->render(function (\Illuminate\Database\Eloquent\ModelNotFoundException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'success' => false,
                    'error' => [
                        'code' => 'NOT_FOUND',
                        'message' => 'Resource not found.',
                        'details' => [],
                    ],
                    'meta' => [
                        'timestamp' => now()->toIso8601String(),
                        'version' => 'v1',
                    ],
                ], 404);
            }
        });

        $exceptions->render(function (\Symfony\Component\HttpKernel\Exception\NotFoundHttpException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'success' => false,
                    'error' => [
                        'code' => 'NOT_FOUND',
                        'message' => $e->getMessage() ?: 'Resource not found.',
                        'details' => [],
                    ],
                    'meta' => [
                        'timestamp' => now()->toIso8601String(),
                        'version' => 'v1',
                    ],
                ], 404);
            }
        });

        $exceptions->render(function (\Illuminate\Http\Exceptions\ThrottleRequestsException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                $headers = $e->getHeaders();
                $retryAfter = (int) ($headers['Retry-After'] ?? 60);
                return response()->json([
                    'success' => false,
                    'error' => [
                        'code' => 'RATE_LIMITED',
                        'message' => 'Too Many Requests.',
                        'details' => [
                            'retry_after' => $retryAfter,
                        ],
                    ],
                    'meta' => [
                        'timestamp' => now()->toIso8601String(),
                        'version' => 'v1',
                    ],
                ], 429, ['Retry-After' => (string) $retryAfter]);
            }
        });

        $exceptions->render(function (\Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                $headers = $e->getHeaders();
                $retryAfter = (int) ($headers['Retry-After'] ?? 60);
                return response()->json([
                    'success' => false,
                    'error' => [
                        'code' => 'RATE_LIMITED',
                        'message' => 'Too Many Requests.',
                        'details' => [
                            'retry_after' => $retryAfter,
                        ],
                    ],
                    'meta' => [
                        'timestamp' => now()->toIso8601String(),
                        'version' => 'v1',
                    ],
                ], 429, ['Retry-After' => (string) $retryAfter]);
            }
        });

        $exceptions->render(function (\Symfony\Component\HttpKernel\Exception\ConflictHttpException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'success' => false,
                    'error' => [
                        'code' => 'CONFLICT',
                        'message' => $e->getMessage() ?: 'Resource conflict.',
                        'details' => [],
                    ],
                    'meta' => [
                        'timestamp' => now()->toIso8601String(),
                        'version' => 'v1',
                    ],
                ], 409);
            }
        });

        $exceptions->render(function (\Symfony\Component\HttpKernel\Exception\LockedHttpException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'success' => false,
                    'error' => [
                        'code' => 'LOCKED',
                        'message' => $e->getMessage() ?: 'Resource locked.',
                        'details' => [],
                    ],
                    'meta' => [
                        'timestamp' => now()->toIso8601String(),
                        'version' => 'v1',
                    ],
                ], 423);
            }
        });
    })->create();
