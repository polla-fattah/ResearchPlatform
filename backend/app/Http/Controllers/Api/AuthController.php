<?php

namespace App\Http\Controllers\Api;

use App\Models\User;
use App\Models\ResearcherProfile;
use App\Models\EmailVerification;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use App\Services\TotpService;

class AuthController extends ApiController
{
    /**
     * Register a new applicant account (ACC-01 / DEF-13).
     */
    public function register(Request $request): JsonResponse
    {
        // Rate limiting: 10 registrations per IP per hour
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
            'status' => 'unverified',
        ]);

        $user->profile()->create([
            'affiliation' => $validated['affiliation'] ?? null,
            'biography' => $validated['biography'] ?? null,
            'research_interests' => $validated['research_interests'] ?? [],
            'is_public' => false,
        ]);

        // Generate email verification token
        $verifToken = Str::random(64);
        EmailVerification::create([
            'email' => $user->email,
            'token' => $verifToken,
            'expires_at' => now()->addHours(24),
        ]);

        $token = $user->createToken('auth-token')->plainTextToken;

        $responseData = [
            'user' => [
                'id' => $user->id,
                'display_name' => $user->display_name,
                'email' => $user->email,
                'status' => $user->status,
                'roles' => $user->roles,
                'is_admin' => $user->is_admin,
                'mfa_enabled' => $user->mfa_enabled,
                'preferred_language' => $user->preferred_language,
            ],
            'token' => $token,
        ];

        if (app()->environment('local', 'testing')) {
            $responseData['verification_token'] = $verifToken;
        }

        return $this->successResponse($responseData, 'Registration successful. Please verify your email.', 201);
    }

    /**
     * Authenticate and obtain Bearer token (ACC-04 / DEF-6 / DEF-13).
     */
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        // Rate limiting (DEF-13): 5 failed attempts pauses for 15 minutes (900 seconds)
        $throttleKey = 'login:' . strtolower($request->email) . '|' . $request->ip();

        if (RateLimiter::tooManyAttempts($throttleKey, 5)) {
            $seconds = RateLimiter::availableIn($throttleKey);
            return $this->errorResponse(
                'Too many failed login attempts. Sign-in pauses for 15 minutes.',
                'RATE_LIMITED',
                429,
                ['retry_after' => $seconds]
            )->header('Retry-After', $seconds);
        }

        $user = User::where('email', strtolower($request->email))->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            RateLimiter::hit($throttleKey, 900);
            return $this->errorResponse('Invalid email or password credentials.', 'INVALID_CREDENTIALS', 401);
        }

        RateLimiter::clear($throttleKey);

        if ($user->status === 'suspended') {
            return $this->errorResponse('Your researcher account has been suspended.', 'ACCOUNT_SUSPENDED', 403);
        }

        // TOTP MFA challenge check (API-2)
        if ($user->mfa_enabled) {
            $challengeToken = Str::random(40);
            cache()->put("mfa_challenge:{$challengeToken}", $user->id, now()->addMinutes(5));

            return $this->successResponse([
                'mfa_required' => true,
                'challenge_token' => $challengeToken,
            ], 'MFA verification required.');
        }

        $token = $user->createToken('auth-token')->plainTextToken;

        return $this->successResponse([
            'user' => [
                'id' => $user->id,
                'display_name' => $user->display_name,
                'email' => $user->email,
                'status' => $user->status,
                'roles' => $user->roles,
                'is_admin' => $user->is_admin,
                'mfa_enabled' => $user->mfa_enabled,
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
     * Retrieve current user profile and stats (ACC-05 / DEF-6).
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user()->load('profile');

        return $this->successResponse([
            'id' => $user->id,
            'display_name' => $user->display_name,
            'email' => $user->email,
            'status' => $user->status,
            'roles' => $user->roles,
            'is_admin' => $user->is_admin,
            'mfa_enabled' => $user->mfa_enabled,
            'preferred_language' => $user->preferred_language,
            'profile' => $user->profile,
            'display_preferences' => $user->profile?->display_preferences ?? [
                'default_content_language' => 'ar',
                'numerals' => 'eastern_arabic',
                'calendar' => 'gregorian_hijri',
                'time_zone' => 'UTC',
            ],
            'stats' => [
                'owned_projects_count' => $user->ownedProjects()->where('is_deleted', false)->count(),
                'memberships_count' => $user->memberships()->count(),
                'library_items_count' => $user->libraryItems()->count(),
            ],
        ]);
    }

    /**
     * Update researcher profile and display preferences (ACC-06 / API-2).
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
            'display_preferences' => 'nullable|array',
            'display_preferences.default_content_language' => 'nullable|string|in:ar,ckb,en',
            'display_preferences.numerals' => 'nullable|string|in:eastern_arabic,western',
            'display_preferences.calendar' => 'nullable|string|in:gregorian_hijri,hijri_gregorian,gregorian',
            'display_preferences.time_zone' => 'nullable|string',
        ]);

        if (isset($validated['display_name']) || isset($validated['preferred_language'])) {
            $user->update([
                'display_name' => $validated['display_name'] ?? $user->display_name,
                'preferred_language' => $validated['preferred_language'] ?? $user->preferred_language,
            ]);
        }

        $profileData = array_intersect_key($validated, array_flip([
            'affiliation', 'biography', 'research_interests', 'is_public', 'public_fields', 'display_preferences'
        ]));

        if (!empty($profileData)) {
            $user->profile()->updateOrCreate(['user_id' => $user->id], $profileData);
        }

        return $this->successResponse($user->fresh()->load('profile'), 'Profile updated successfully.');
    }

    // ------------------------------------------------------------------------
    // Email Verification & Password Recovery (API-1)
    // ------------------------------------------------------------------------

    public function verifyEmail(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => 'required|string',
        ]);

        $verif = EmailVerification::where('token', $validated['token'])->first();

        if (!$verif || $verif->isExpired()) {
            return $this->errorResponse('Verification token is expired or invalid.', 'GONE', 410);
        }

        $user = User::where('email', $verif->email)->first();
        if ($user && $user->status === 'unverified') {
            $user->update(['status' => 'pending']);
        }

        $verif->delete();

        return $this->successResponse(null, 'Email successfully verified. Application is pending review.');
    }

    public function resendVerification(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => 'required|email',
        ]);

        $email = strtolower($validated['email']);

        // Rate limiting (DEF-13): 1/min, 5/day
        $minThrottleKey = "resend_min:{$email}";
        $dayThrottleKey = "resend_day:{$email}";

        if (RateLimiter::tooManyAttempts($minThrottleKey, 1)) {
            $retryAfter = RateLimiter::availableIn($minThrottleKey);
            return $this->errorResponse(
                'Please wait 1 minute before requesting another verification email.',
                'RATE_LIMITED',
                429,
                ['retry_after' => $retryAfter]
            )->header('Retry-After', $retryAfter);
        }

        if (RateLimiter::tooManyAttempts($dayThrottleKey, 5)) {
            $retryAfter = RateLimiter::availableIn($dayThrottleKey);
            return $this->errorResponse(
                'Daily verification email limit reached (5 per day).',
                'RATE_LIMITED',
                429,
                ['retry_after' => $retryAfter]
            )->header('Retry-After', $retryAfter);
        }

        RateLimiter::hit($minThrottleKey, 60);
        RateLimiter::hit($dayThrottleKey, 86400);

        $token = Str::random(64);
        EmailVerification::updateOrCreate(
            ['email' => $email],
            ['token' => $token, 'expires_at' => now()->addHours(24)]
        );

        $remainingToday = 5 - RateLimiter::attempts($dayThrottleKey);

        return $this->successResponse([
            'remaining_today' => max(0, $remainingToday),
            'verification_token' => $token, // Returned for dev testing
        ], 'Verification email sent.');
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => 'required|email',
        ]);

        $email = strtolower($validated['email']);
        $user = User::where('email', $email)->first();

        if ($user) {
            $token = Str::random(64);
            $user->update([
                'password_reset_token' => $token,
                'password_reset_expires_at' => now()->addHour(),
            ]);
        }

        // Always return 200 (no user enumeration)
        return $this->successResponse(null, 'If an account exists with this email, a password reset link has been dispatched.');
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => 'required|email',
            'token' => 'required|string',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $user = User::where('email', strtolower($validated['email']))
            ->where('password_reset_token', $validated['token'])
            ->where('password_reset_expires_at', '>', now())
            ->first();

        if (!$user) {
            return $this->errorResponse('Password reset token is invalid or has expired.', 'VALIDATION_ERROR', 422);
        }

        $user->update([
            'password' => Hash::make($validated['password']),
            'password_reset_token' => null,
            'password_reset_expires_at' => null,
        ]);

        return $this->successResponse(null, 'Password has been reset successfully. You may now log in.');
    }

    public function changePassword(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'current_password' => 'required|string',
            'password' => 'required|string|min:8|confirmed',
        ]);

        if (!Hash::check($validated['current_password'], $user->password)) {
            return $this->errorResponse('Current password does not match.', 'VALIDATION_ERROR', 422, [
                'current_password' => ['The provided current password is incorrect.'],
            ]);
        }

        $user->update(['password' => Hash::make($validated['password'])]);

        return $this->successResponse(null, 'Password changed successfully.');
    }

    // ------------------------------------------------------------------------
    // Session Management (API-2)
    // ------------------------------------------------------------------------

    public function listSessions(Request $request): JsonResponse
    {
        $user = $request->user();
        $currentTokenId = $user->currentAccessToken()?->id;

        $sessions = $user->tokens()->orderBy('last_used_at', 'desc')->get()->map(function ($t) use ($currentTokenId) {
            return [
                'id' => $t->id,
                'name' => $t->name,
                'device' => 'Web Browser',
                'last_used_at' => $t->last_used_at?->toIso8601String(),
                'created_at' => $t->created_at?->toIso8601String(),
                'current' => $t->id === $currentTokenId,
            ];
        });

        return $this->successResponse($sessions);
    }

    public function revokeSession(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $user->tokens()->where('id', $id)->delete();

        return $this->successResponse(null, 'Session revoked.');
    }

    public function revokeOtherSessions(Request $request): JsonResponse
    {
        $user = $request->user();
        $currentTokenId = $user->currentAccessToken()?->id;

        $user->tokens()->where('id', '!=', $currentTokenId)->delete();

        return $this->successResponse(null, 'All other sessions have been terminated.');
    }

    // ------------------------------------------------------------------------
    // TOTP MFA (API-2 / ACC-08)
    // ------------------------------------------------------------------------

    public function mfaEnroll(Request $request): JsonResponse
    {
        $user = $request->user();
        $secret = TotpService::generateSecret(16);

        $user->profile()->updateOrCreate(
            ['user_id' => $user->id],
            ['mfa_secret' => $secret]
        );

        $otpauth = "otpauth://totp/HadithPlatform:{$user->email}?secret={$secret}&issuer=HadithResearchPlatform";

        return $this->successResponse([
            'secret' => $secret,
            'otpauth_url' => $otpauth,
        ], 'MFA enrollment initiated.');
    }

    public function mfaConfirm(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => 'required|string|size:6',
        ]);

        $user = $request->user();
        $secret = $user->profile?->mfa_secret;

        if (!$secret || !TotpService::verify($secret, $validated['code'])) {
            return $this->errorResponse('Invalid MFA verification code.', 'VALIDATION_ERROR', 422, [
                'code' => ['The provided six-digit verification code is invalid.'],
            ]);
        }

        $plainRecoveryCodes = [
            Str::upper(Str::random(10)),
            Str::upper(Str::random(10)),
            Str::upper(Str::random(10)),
            Str::upper(Str::random(10)),
            Str::upper(Str::random(10)),
        ];

        // Store hashed single-use recovery codes
        $hashedCodes = array_map(fn($c) => hash('sha256', strtoupper($c)), $plainRecoveryCodes);

        $user->profile()->update([
            'recovery_codes' => $hashedCodes,
        ]);

        return $this->successResponse([
            'mfa_enabled' => true,
            'recovery_codes' => $plainRecoveryCodes,
        ], 'MFA confirmed and enabled.');
    }

    public function mfaDisable(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'password' => 'required_without:code|nullable|string',
            'code' => 'required_without:password|nullable|string',
        ]);

        $authenticated = false;
        if (!empty($validated['password']) && Hash::check($validated['password'], $user->password)) {
            $authenticated = true;
        }

        if (!$authenticated && !empty($validated['code']) && $user->profile?->mfa_secret) {
            if (TotpService::verify($user->profile->mfa_secret, $validated['code'])) {
                $authenticated = true;
            }
        }

        if (!$authenticated) {
            return $this->errorResponse('Current password or valid MFA code is required to disable MFA.', 'VALIDATION_ERROR', 422, [
                'password' => ['Invalid credentials.'],
            ]);
        }

        $user->profile()->update([
            'mfa_secret' => null,
            'recovery_codes' => null,
        ]);

        return $this->successResponse([
            'mfa_enabled' => false,
        ], 'MFA disabled successfully.');
    }

    public function mfaChallenge(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'challenge_token' => 'required|string',
            'code' => 'required|string',
        ]);

        $userId = cache()->get("mfa_challenge:{$validated['challenge_token']}");
        if (!$userId) {
            return $this->errorResponse('MFA challenge expired or invalid.', 'UNAUTHENTICATED', 401);
        }

        $user = User::with('profile')->findOrFail($userId);
        $secret = $user->profile?->mfa_secret;
        $inputCode = trim($validated['code']);

        $verified = false;

        // 1. Try TOTP code verification
        if ($secret && strlen($inputCode) === 6 && ctype_digit($inputCode)) {
            // Replay protection: check if used in current time step
            $replayKey = "totp_used:{$user->id}:{$inputCode}";
            if (!cache()->has($replayKey) && TotpService::verify($secret, $inputCode)) {
                cache()->put($replayKey, true, 60);
                $verified = true;
            }
        }

        // 2. Try single-use recovery code verification if TOTP failed
        if (!$verified) {
            $recoveryCodes = $user->profile?->recovery_codes ?? [];
            $inputHash = hash('sha256', strtoupper($inputCode));

            foreach ($recoveryCodes as $index => $storedHash) {
                if (hash_equals($storedHash, $inputHash)) {
                    $verified = true;
                    // Single use: remove the consumed recovery code
                    unset($recoveryCodes[$index]);
                    $user->profile->update(['recovery_codes' => array_values($recoveryCodes)]);
                    break;
                }
            }
        }

        if (!$verified) {
            return $this->errorResponse('Invalid MFA verification code or recovery code.', 'UNAUTHENTICATED', 401);
        }

        cache()->forget("mfa_challenge:{$validated['challenge_token']}");

        $token = $user->createToken('auth-token')->plainTextToken;

        return $this->successResponse([
            'user' => [
                'id' => $user->id,
                'display_name' => $user->display_name,
                'email' => $user->email,
                'status' => $user->status,
                'roles' => $user->roles,
                'is_admin' => $user->is_admin,
                'mfa_enabled' => $user->mfa_enabled,
                'preferred_language' => $user->preferred_language,
            ],
            'token' => $token,
        ], 'MFA verification successful.');
    }

    // ------------------------------------------------------------------------
    // Account Closure (API-2 / ACC-07)
    // ------------------------------------------------------------------------

    public function closeAccount(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'password' => 'required|string',
            'reason' => 'nullable|string',
        ]);

        if (!Hash::check($validated['password'], $user->password)) {
            return $this->errorResponse('Password is incorrect.', 'VALIDATION_ERROR', 422, [
                'password' => ['The provided password is incorrect.'],
            ]);
        }

        $user->update([
            'status' => 'closure_requested',
            'closure_requested_at' => now(),
            'closure_reason' => $validated['reason'] ?? null,
        ]);

        return $this->successResponse([
            'status' => 'closure_requested',
            'policy' => 'Your account closure request has been submitted to administrators. Owned projects without co-owners will be placed in a 30-day recovery window. Published datasets will preserve your attribution unless an explicit anonymisation waiver was provided.',
        ], 'Account closure requested.');
    }
}
