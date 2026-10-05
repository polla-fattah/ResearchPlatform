<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureAccountApproved
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (!$user) {
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

        if ($user->status === 'suspended') {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'ACCOUNT_SUSPENDED',
                    'message' => 'Your researcher account has been suspended.',
                    'details' => [],
                ],
                'meta' => [
                    'timestamp' => now()->toIso8601String(),
                    'version' => 'v1',
                ],
            ], 403);
        }

        if ($user->status !== 'approved' && !$user->is_admin) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'ACCOUNT_NOT_APPROVED',
                    'message' => "Your researcher account is not approved yet. Current status: {$user->status}.",
                    'details' => [
                        'current_status' => $user->status,
                    ],
                ],
                'meta' => [
                    'timestamp' => now()->toIso8601String(),
                    'version' => 'v1',
                ],
            ], 403);
        }

        return $next($request);
    }
}
