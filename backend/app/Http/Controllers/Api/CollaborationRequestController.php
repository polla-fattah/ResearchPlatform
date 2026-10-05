<?php

namespace App\Http\Controllers\Api;

use App\Models\CollaborationRequest;
use App\Models\ProjectMembership;
use App\Models\ResearchProject;
use App\Services\AuthPolicyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CollaborationRequestController extends ApiController
{
    public function __construct(
        protected AuthPolicyService $policyService
    ) {}

    public function store(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);

        // Check if project has an announcement or is open to inquiries
        $validated = $request->validate([
            'message' => 'required|string|min:10',
            'contact_email' => 'required|email',
        ]);

        // Prevent project owner or existing member from submitting interest to own project
        if ($project->owner_id === $request->user()->id) {
            return $this->errorResponse('Cannot submit collaboration request to your own project.', 'INVALID_OPERATION', 422);
        }

        $collabRequest = CollaborationRequest::create([
            'project_id' => $projectId,
            'requester_id' => $request->user()->id,
            'message' => $validated['message'],
            'contact_email' => $validated['contact_email'],
            'status' => 'pending',
        ]);

        return $this->successResponse($collabRequest->load('requester'), 'Collaboration interest request submitted.', 201);
    }

    public function index(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $requests = CollaborationRequest::where('project_id', $projectId)
            ->with('requester')
            ->orderBy('created_at', 'desc')
            ->get();

        return $this->successResponse($requests, 'Collaboration requests retrieved.');
    }

    public function updateStatus(Request $request, int $projectId, int $requestId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $collabRequest = CollaborationRequest::where('project_id', $projectId)->findOrFail($requestId);

        $validated = $request->validate([
            'status' => 'required|string|in:accepted,declined',
            'decision_notes' => 'nullable|string',
            'role_to_grant' => 'nullable|string|in:researcher,reviewer,viewer',
        ]);

        $collabRequest->update([
            'status' => $validated['status'],
            'decision_notes' => $validated['decision_notes'] ?? null,
        ]);

        // If accepted, automatically invite requester to project membership
        if ($validated['status'] === 'accepted') {
            ProjectMembership::updateOrCreate(
                [
                    'project_id' => $projectId,
                    'user_id' => $collabRequest->requester_id,
                ],
                [
                    'role' => $validated['role_to_grant'] ?? 'researcher',
                    'status' => 'accepted',
                    'accepted_at' => now(),
                ]
            );
        }

        return $this->successResponse($collabRequest->fresh('requester'), 'Collaboration request status updated.');
    }
}
