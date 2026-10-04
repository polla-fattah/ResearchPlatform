<?php

namespace App\Http\Controllers\Api;

use App\Models\User;
use App\Models\ResearcherProfile;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends ApiController
{
    /**
     * Register a new applicant account (ACC-01).
     */
    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'display_name' => 'required|string|max:255',
            'email' => 'required|email|max:255|unique:users,email',
            'password' => 'required|string|min:8',
            'preferred_language' => 'nullable|string|in:ar,ckb,en',
            'affiliation' => 'nullable|string|max:500',
            'biography' => 'nullable|string',
            'research_interests' => 'nullable|array',
        ]);

        $user = User::create([
            'display_name' => $validated['display_name'],
            'email' => strtolower($validated['email']),
            'password' => Hash::make($validated['password']),
            'preferred_language' => $validated['preferred_language'] ?? 'ar',
            'status' => 'pending', // In local/dev we allow pending application directly
        ]);

        $user->profile()->create([
            'affiliation' => $validated['affiliation'] ?? null,
            'biography' => $validated['biography'] ?? null,
            'research_interests' => $validated['research_interests'] ?? [],
            'is_public' => false,
        ]);

        $token = $user->createToken('auth-token')->plainTextToken;

        return $this->successResponse([
            'user' => [
                'id' => $user->id,
                'display_name' => $user->display_name,
                'email' => $user->email,
                'status' => $user->status,
                'preferred_language' => $user->preferred_language,
            ],
            'token' => $token,
        ], 'Registration successful. Application pending review.', 201);
    }

    /**
     * Authenticate and obtain Bearer token (ACC-04).
     */
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $user = User::where('email', strtolower($request->email))->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            return $this->errorResponse('Invalid email or password credentials.', 'INVALID_CREDENTIALS', 401);
        }

        if ($user->status === 'suspended') {
            return $this->errorResponse('Your researcher account has been suspended.', 'ACCOUNT_SUSPENDED', 403);
        }

        // Revoke older tokens if single session preferred, or keep multiple
        $token = $user->createToken('auth-token')->plainTextToken;

        return $this->successResponse([
            'user' => [
                'id' => $user->id,
                'display_name' => $user->display_name,
                'email' => $user->email,
                'status' => $user->status,
                'preferred_language' => $user->preferred_language,
            ],
            'token' => $token,
        ], 'Authentication successful.');
    }

    /**
     * Terminate session (ACC-04).
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return $this->successResponse(null, 'Successfully logged out.');
    }

    /**
     * Retrieve current user profile and stats (ACC-05).
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user()->load('profile');

        return $this->successResponse([
            'id' => $user->id,
            'display_name' => $user->display_name,
            'email' => $user->email,
            'status' => $user->status,
            'preferred_language' => $user->preferred_language,
            'profile' => $user->profile,
            'stats' => [
                'owned_projects_count' => $user->ownedProjects()->count(),
                'memberships_count' => $user->memberships()->count(),
                'library_items_count' => $user->libraryItems()->count(),
            ],
        ]);
    }

    /**
     * Update researcher profile (ACC-06).
     */
    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'display_name' => 'sometimes|string|max:255',
            'preferred_language' => 'sometimes|string|in:ar,ckb,en',
            'affiliation' => 'nullable|string|max:500',
            'biography' => 'nullable|string',
            'research_interests' => 'nullable|array',
            'is_public' => 'sometimes|boolean',
            'public_fields' => 'nullable|array',
        ]);

        if (isset($validated['display_name']) || isset($validated['preferred_language'])) {
            $user->update([
                'display_name' => $validated['display_name'] ?? $user->display_name,
                'preferred_language' => $validated['preferred_language'] ?? $user->preferred_language,
            ]);
        }

        $profileData = array_intersect_key($validated, array_flip([
            'affiliation', 'biography', 'research_interests', 'is_public', 'public_fields'
        ]));

        if (!empty($profileData)) {
            $user->profile()->updateOrCreate(['user_id' => $user->id], $profileData);
        }

        return $this->successResponse($user->fresh()->load('profile'), 'Profile updated successfully.');
    }
}
