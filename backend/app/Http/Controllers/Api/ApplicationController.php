<?php

namespace App\Http\Controllers\Api;

use App\Models\ResearcherApplication;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class ApplicationController extends ApiController
{
    /**
     * Submit an application for researcher status (ACC-01).
     */
    public function submit(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'research_statement' => 'required|string|min:20',
            'sample_publications' => 'nullable|string',
        ]);

        $application = ResearcherApplication::create([
            'user_id' => $user->id,
            'status' => 'pending',
            'research_statement' => $validated['research_statement'],
            'sample_publications' => $validated['sample_publications'] ?? null,
        ]);

        return $this->successResponse($application, 'Application submitted for review.', 201);
    }

    /**
     * Check status of applicant's researcher application (ACC-01).
     */
    public function myStatus(Request $request): JsonResponse
    {
        $user = $request->user();

        $latestApplication = ResearcherApplication::where('user_id', $user->id)
            ->latest()
            ->first();

        return $this->successResponse([
            'user_status' => $user->status,
            'application' => $latestApplication,
        ]);
    }
}
