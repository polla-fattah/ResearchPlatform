<?php

namespace App\Http\Controllers\Api;

use App\Models\Announcement;
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

        $responsePayload = [
            'id' => $collabRequest->id,
            'project_id' => $collabRequest->project_id,
            'requester_id' => $collabRequest->requester_id,
            'message' => $collabRequest->message,
            'contact_email' => $collabRequest->contact_email,
            'status' => $collabRequest->status,
            'decision_notes' => $collabRequest->decision_notes,
            'created_at' => $collabRequest->created_at?->toIso8601String(),
            'requester' => [
                'id' => $request->user()->id,
                'display_name' => $request->user()->display_name,
            ],
        ];

        return $this->successResponse($responsePayload, 'Collaboration interest request submitted.', 201);
    }

    public function index(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);

        // Owner only on collaboration inbox (C-28)
        if ($project->owner_id !== $request->user()->id) {
            return $this->errorResponse('Only the project owner can view collaboration requests.', 'FORBIDDEN', 403);
        }

        $requests = CollaborationRequest::where('project_id', $projectId)
            ->with('requester:id,display_name')
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($req) {
                return [
                    'id' => $req->id,
                    'project_id' => $req->project_id,
                    'requester_id' => $req->requester_id,
                    'message' => $req->message,
                    'contact_email' => $req->contact_email,
                    'status' => $req->status,
                    'decision_notes' => $req->decision_notes,
                    'created_at' => $req->created_at?->toIso8601String(),
                    'requester' => $req->requester ? [
                        'id' => $req->requester->id,
                        'display_name' => $req->requester->display_name,
                    ] : null,
                ];
            });

        return $this->successResponse($requests, 'Collaboration requests retrieved.');
    }

    public function updateStatus(Request $request, int $projectId, int $requestId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);

        // Owner only on deciding collaboration requests (C-28)
        if ($project->owner_id !== $request->user()->id) {
            return $this->errorResponse('Only the project owner can decide on collaboration requests.', 'FORBIDDEN', 403);
        }

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

        if ($validated['status'] === 'accepted') {
            if ($collabRequest->requester_id) {
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
        }

        $responsePayload = [
            'id' => $collabRequest->id,
            'project_id' => $collabRequest->project_id,
            'requester_id' => $collabRequest->requester_id,
            'message' => $collabRequest->message,
            'contact_email' => $collabRequest->contact_email,
            'status' => $collabRequest->status,
            'decision_notes' => $collabRequest->decision_notes,
            'created_at' => $collabRequest->created_at?->toIso8601String(),
            'requester' => $collabRequest->requester ? [
                'id' => $collabRequest->requester->id,
                'display_name' => $collabRequest->requester->display_name,
            ] : null,
        ];

        return $this->successResponse($responsePayload, 'Collaboration request status updated.');
    }

    /**
     * Submit public collaboration request from public announcement page (API-13 / screen 40 / C-28).
     */
    public function storePublic(Request $request, string $slug): JsonResponse
    {
        $announcement = Announcement::where('public_slug', $slug)
            ->where('status', 'published')
            ->firstOrFail();

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255',
            'affiliation' => 'nullable|string|max:255',
            'message' => 'required|string|min:10',
            'consent' => 'required|accepted',
        ]);

        $collabRequest = CollaborationRequest::create([
            'project_id' => $announcement->project_id,
            'requester_id' => $request->user()?->id,
            'message' => $validated['message'] . " [From: {$validated['name']} ({$validated['email']})]",
            'contact_email' => $validated['email'],
            'status' => 'pending',
        ]);

        $requesterData = $request->user() ? [
            'id' => $request->user()->id,
            'display_name' => $request->user()->display_name,
        ] : null;

        $responsePayload = [
            'id' => $collabRequest->id,
            'project_id' => $collabRequest->project_id,
            'requester_id' => $collabRequest->requester_id,
            'message' => $collabRequest->message,
            'contact_email' => $collabRequest->contact_email,
            'status' => $collabRequest->status,
            'decision_notes' => $collabRequest->decision_notes,
            'created_at' => $collabRequest->created_at?->toIso8601String(),
            'requester' => $requesterData,
        ];

        return $this->successResponse($responsePayload, 'Collaboration interest request submitted.', 202);
    }
}
