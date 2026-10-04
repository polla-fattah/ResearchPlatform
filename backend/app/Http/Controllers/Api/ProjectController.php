<?php

namespace App\Http\Controllers\Api;

use App\Models\ResearchProject;
use App\Models\ProjectMembership;
use App\Services\AuthPolicyService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class ProjectController extends ApiController
{
    public function __construct(
        protected AuthPolicyService $policyService
    ) {}

    /**
     * List projects the authenticated user participates in (Module 4).
     */
    public function index(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $query = ResearchProject::where(function ($q) use ($userId) {
            $q->where('owner_id', $userId)
              ->orWhereHas('memberships', function ($mq) use ($userId) {
                  $mq->where('user_id', $userId)->where('status', 'accepted');
              });
        })->where('is_deleted', false);

        if ($request->filled('stage')) {
            $query->where('stage', $request->input('stage'));
        }

        if ($request->has('is_archived')) {
            $isArchived = filter_var($request->input('is_archived'), FILTER_VALIDATE_BOOLEAN);
            $query->where('is_archived', $isArchived);
        }

        if ($request->filled('q')) {
            $term = $request->input('q');
            $query->where(function ($q) use ($term) {
                $q->where('title', 'ILIKE', "%{$term}%")
                  ->orWhere('question', 'ILIKE', "%{$term}%")
                  ->orWhere('scope', 'ILIKE', "%{$term}%");
            });
        }

        $perPage = min((int) ($request->input('per_page', 20)), 100);

        $projects = $query->with(['owner', 'memberships.user'])
            ->latest('updated_at')
            ->paginate($perPage);

        return $this->paginatedResponse($projects);
    }

    /**
     * Create a new research project workspace.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'title' => 'required|string|max:500',
            'question' => 'required|string',
            'scope' => 'nullable|string',
            'primary_language' => 'nullable|string|max:10',
            'stage' => 'nullable|string|in:scoping,collecting,analysing,writing,reviewing,completed',
        ]);

        $project = DB::transaction(function () use ($user, $validated) {
            $project = ResearchProject::create([
                'owner_id' => $user->id,
                'title' => $validated['title'],
                'question' => $validated['question'],
                'scope' => $validated['scope'] ?? null,
                'primary_language' => $validated['primary_language'] ?? 'ar',
                'stage' => $validated['stage'] ?? 'scoping',
                'is_archived' => false,
                'is_deleted' => false,
            ]);

            ProjectMembership::create([
                'project_id' => $project->id,
                'user_id' => $user->id,
                'role' => 'owner',
                'status' => 'accepted',
                'accepted_at' => now(),
            ]);

            return $project;
        });

        return $this->successResponse(
            $project->load(['owner', 'memberships.user']),
            'Research project workspace created.',
            201
        );
    }

    /**
     * Get project details and active workspace state.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->find($id);
        if (!$project) {
            return $this->errorResponse('Project not found.', 'NOT_FOUND', 404);
        }

        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $project->load(['owner', 'memberships.user']);

        return $this->successResponse($project);
    }

    /**
     * Update project attributes.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->find($id);
        if (!$project) {
            return $this->errorResponse('Project not found.', 'NOT_FOUND', 404);
        }

        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:500',
            'question' => 'sometimes|required|string',
            'scope' => 'nullable|string',
            'primary_language' => 'nullable|string|max:10',
        ]);

        $project->update($validated);

        return $this->successResponse($project->fresh(['owner', 'memberships']), 'Project updated.');
    }

    /**
     * Advance or change the project lifecycle stage.
     */
    public function updateStage(Request $request, int $id): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->find($id);
        if (!$project) {
            return $this->errorResponse('Project not found.', 'NOT_FOUND', 404);
        }

        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $validated = $request->validate([
            'stage' => 'required|string|in:scoping,collecting,analysing,writing,reviewing,completed',
            'rationale' => 'nullable|string',
        ]);

        $project->update(['stage' => $validated['stage']]);

        return $this->successResponse($project, "Project stage transitioned to {$validated['stage']}.");
    }

    /**
     * Archive or unarchive a project.
     */
    public function toggleArchive(Request $request, int $id): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->find($id);
        if (!$project) {
            return $this->errorResponse('Project not found.', 'NOT_FOUND', 404);
        }

        $this->policyService->authorizeProject($request->user(), 'archive', $project);

        $isArchived = !$project->is_archived;
        $project->update([
            'is_archived' => $isArchived,
            'archived_at' => $isArchived ? now() : null,
        ]);

        $msg = $isArchived ? 'Project archived.' : 'Project unarchived.';
        return $this->successResponse($project, $msg);
    }

    /**
     * Soft delete project with 30-day recovery window.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->find($id);
        if (!$project) {
            return $this->errorResponse('Project not found.', 'NOT_FOUND', 404);
        }

        $this->policyService->authorizeProject($request->user(), 'delete', $project);

        $project->update([
            'is_deleted' => true,
            'deleted_at' => now(),
            'recovery_deadline' => now()->addDays(30),
        ]);

        return $this->successResponse(null, 'Project deleted with a 30-day recovery deadline.');
    }

    /**
     * List project members and their roles.
     */
    public function members(Request $request, int $id): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->find($id);
        if (!$project) {
            return $this->errorResponse('Project not found.', 'NOT_FOUND', 404);
        }

        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $members = ProjectMembership::where('project_id', $project->id)
            ->with(['user.profile'])
            ->get();

        return $this->successResponse($members);
    }

    /**
     * Add / invite a member to the project.
     */
    public function addMember(Request $request, int $id): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->find($id);
        if (!$project) {
            return $this->errorResponse('Project not found.', 'NOT_FOUND', 404);
        }

        $this->policyService->authorizeProject($request->user(), 'manage_members', $project);

        $validated = $request->validate([
            'user_id' => 'required|integer|exists:users,id',
            'role' => 'required|string|in:owner,researcher,reviewer,viewer',
        ]);

        $membership = ProjectMembership::updateOrCreate(
            [
                'project_id' => $project->id,
                'user_id' => $validated['user_id'],
            ],
            [
                'role' => $validated['role'],
                'status' => 'accepted',
                'invited_by' => $request->user()->id,
                'accepted_at' => now(),
            ]
        );

        return $this->successResponse($membership->load('user'), 'Member added to project.', 201);
    }

    /**
     * Update member role.
     */
    public function updateMember(Request $request, int $id, int $userId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->find($id);
        if (!$project) {
            return $this->errorResponse('Project not found.', 'NOT_FOUND', 404);
        }

        $this->policyService->authorizeProject($request->user(), 'manage_members', $project);

        if ($userId === $project->owner_id) {
            return $this->errorResponse('Cannot modify owner membership directly.', 'FORBIDDEN', 403);
        }

        $membership = ProjectMembership::where('project_id', $project->id)
            ->where('user_id', $userId)
            ->first();

        if (!$membership) {
            return $this->errorResponse('Member not found in this project.', 'NOT_FOUND', 404);
        }

        $validated = $request->validate([
            'role' => 'required|string|in:researcher,reviewer,viewer',
        ]);

        $membership->update(['role' => $validated['role']]);

        return $this->successResponse($membership->load('user'), 'Member role updated.');
    }

    /**
     * Remove member from project.
     */
    public function removeMember(Request $request, int $id, int $userId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->find($id);
        if (!$project) {
            return $this->errorResponse('Project not found.', 'NOT_FOUND', 404);
        }

        $this->policyService->authorizeProject($request->user(), 'manage_members', $project);

        if ($userId === $project->owner_id) {
            return $this->errorResponse('The project owner cannot be removed.', 'FORBIDDEN', 403);
        }

        $membership = ProjectMembership::where('project_id', $project->id)
            ->where('user_id', $userId)
            ->first();

        if (!$membership) {
            return $this->errorResponse('Member not found.', 'NOT_FOUND', 404);
        }

        $membership->update([
            'status' => 'revoked',
            'revoked_at' => now(),
        ]);

        return $this->successResponse(null, 'Member access revoked immediately.');
    }
}
