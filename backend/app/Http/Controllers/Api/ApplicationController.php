<?php

namespace App\Http\Controllers\Api;

use App\Models\User;
use App\Models\ResearcherApplication;
use App\Models\ApplicationReply;
use App\Models\EmailVerification;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

class ApplicationController extends ApiController
{
    /**
     * Submit an application for researcher status (ACC-01 / API-1).
     * Accepts both the standalone statement and the unified application form.
     */
    public function submit(Request $request): JsonResponse
    {
        $user = $request->user();

        // If unauthenticated, handle unified registration + application
        if (!$user) {
            // Rate limiting (DEF-13 / C-1): 10 registrations/applications per IP per hour
            $throttleKey = 'register:' . $request->ip();
            if (RateLimiter::tooManyAttempts($throttleKey, 10)) {
                $seconds = RateLimiter::availableIn($throttleKey);
                return $this->errorResponse(
                    'Too many registration attempts. Please try again later.',
                    'RATE_LIMITED',
                    429,
                    ['retry_after' => $seconds]
                )->header('Retry-After', $seconds);
            }
            RateLimiter::hit($throttleKey, 3600);

            $validated = $request->validate([
                'display_name' => 'required|string|max:255',
                'email' => 'required|email|max:255|unique:users,email',
                'password' => 'required|string|min:8|confirmed',
                'research_interests' => 'required',
                'preferred_language' => 'nullable|string|in:ar,ckb,en',
                'affiliation' => 'nullable|string|max:500',
                'biography' => 'nullable|string',
            ]);

            $interests = is_array($validated['research_interests'])
                ? $validated['research_interests']
                : array_map('trim', explode(',', $validated['research_interests']));

            $statement = is_array($validated['research_interests'])
                ? implode(', ', $validated['research_interests'])
                : (string)$validated['research_interests'];

            $user = User::create([
                'display_name' => $validated['display_name'],
                'email' => strtolower($validated['email']),
                'password' => Hash::make($validated['password']),
                'preferred_language' => $validated['preferred_language'] ?? 'ar',
                'status' => 'unverified',
            ]);

            $user->profile()->create([
                'affiliation' => $validated['affiliation'] ?? null,
                'biography' => $validated['biography'] ?? null,
                'research_interests' => $interests,
                'is_public' => false,
            ]);

            $ref = 'APP-2026-' . str_pad($user->id, 4, '0', STR_PAD_LEFT);
            $application = ResearcherApplication::create([
                'user_id' => $user->id,
                'reference' => $ref,
                'status' => 'pending',
                'research_statement' => $statement,
                'sample_publications' => null,
            ]);

            // Issue email verification token (24 h expiration) (C-1)
            $verifToken = Str::random(64);
            EmailVerification::create([
                'email' => $user->email,
                'token' => $verifToken,
                'expires_at' => now()->addHours(24),
            ]);

            $token = $this->issueToken($user, $request);

            $responseData = [
                'user' => [
                    'id' => $user->id,
                    'display_name' => $user->display_name,
                    'email' => $user->email,
                    'status' => $user->status,
                ],
                'application' => $application,
                'token' => $token,
            ];

            if (app()->environment('local', 'testing')) {
                $responseData['verification_token'] = $verifToken;
            }

            return $this->successResponse($responseData, 'Researcher application submitted. Please verify your email to enter review queue.', 201);
        }

        // Authenticated user submitting or updating application
        $validated = $request->validate([
            'research_statement' => 'sometimes|nullable|string',
            'research_interests' => 'sometimes|nullable',
            'sample_publications' => 'nullable|string',
            'affiliation' => 'nullable|string|max:500',
            'biography' => 'nullable|string',
        ]);

        $statement = $validated['research_statement']
            ?? (is_array($validated['research_interests'] ?? null)
                ? implode(', ', $validated['research_interests'])
                : ($validated['research_interests'] ?? 'Scholarly Hadith Investigation'));

        $ref = 'APP-2026-' . str_pad($user->id, 4, '0', STR_PAD_LEFT);
        $application = ResearcherApplication::updateOrCreate(
            ['user_id' => $user->id],
            [
                'reference' => $ref,
                'status' => 'pending',
                'research_statement' => $statement,
                'sample_publications' => $validated['sample_publications'] ?? null,
            ]
        );

        if (isset($validated['affiliation']) || isset($validated['biography'])) {
            $user->profile()->updateOrCreate(
                ['user_id' => $user->id],
                array_filter([
                    'affiliation' => $validated['affiliation'] ?? null,
                    'biography' => $validated['biography'] ?? null,
                ])
            );
        }

        return $this->successResponse($application, 'Application submitted for review.', 201);
    }

    /**
     * Check status of applicant's researcher application with information requests & replies (API-1).
     */
    public function myStatus(Request $request): JsonResponse
    {
        $user = $request->user();

        $latestApplication = ResearcherApplication::where('user_id', $user->id)
            ->latest()
            ->first();

        $replies = [];
        if ($latestApplication) {
            $replies = ApplicationReply::where('application_id', $latestApplication->id)
                ->orderBy('created_at', 'asc')
                ->get();
        }

        return $this->successResponse([
            'user_status' => $user->status,
            'application' => $latestApplication ? [
                'id' => $latestApplication->id,
                'reference' => $latestApplication->reference ?? ('APP-2026-' . str_pad($latestApplication->id, 4, '0', STR_PAD_LEFT)),
                'status' => $latestApplication->status,
                'submitted_at' => $latestApplication->created_at?->toIso8601String(),
                'decision_reason' => $latestApplication->decision_reason,
                'decided_at' => $latestApplication->decided_at?->toIso8601String(),
                'information_request' => $latestApplication->information_request,
                'replies' => $replies,
            ] : null,
        ]);
    }

    /**
     * Respond to an information request or ask for reconsideration after rejection (API-1).
     */
    public function respond(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'message' => 'required|string|min:5',
        ]);

        $application = ResearcherApplication::where('user_id', $user->id)
            ->latest()
            ->first();

        if (!$application) {
            return $this->errorResponse('No active researcher application found.', 'NOT_FOUND', 404);
        }

        $reply = ApplicationReply::create([
            'application_id' => $application->id,
            'user_id' => $user->id,
            'message' => $validated['message'],
            'created_at' => now(),
        ]);

        // Return application back to pending queue
        $application->update([
            'status' => 'pending',
            'information_request' => null,
        ]);

        return $this->successResponse($reply, 'Response recorded. Your application is back in the review queue.');
    }
}
