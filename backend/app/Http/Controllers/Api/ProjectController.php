<?php

namespace App\Http\Controllers\Api;

use App\Models\ResearchProject;
use App\Models\ProjectMembership;
use App\Models\ProjectMilestone;
use App\Models\ProjectQuestion;
use App\Models\ProjectTransfer;
use App\Models\ProjectActivity;
use App\Models\ProjectResource;
use App\Models\EvidenceItem;
use App\Models\Finding;
use App\Models\Document;
use App\Models\DocumentVersion;
use App\Models\Comment;
use App\Models\Task;
use App\Models\SavedQuery;
use App\Models\AnalysisRun;
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
     * List projects with scopes, counts, and filters (API-4).
     */
    public function index(Request $request): JsonResponse
    {
        $userId = $request->user()->id;
        $scope = $request->query('scope', 'active');

        // Scopes and counts calculation
        $ownedCount = ResearchProject::where('owner_id', $userId)->where('is_deleted', false)->where('is_archived', false)->count();
        $sharedCount = ResearchProject::where('owner_id', '!=', $userId)
            ->whereHas('memberships', fn($q) => $q->where('user_id', $userId)->where('status', 'accepted'))
            ->where('is_deleted', false)
            ->where('is_archived', false)
            ->count();
        $archivedCount = ResearchProject::where(function ($q) use ($userId) {
            $q->where('owner_id', $userId)
              ->orWhereHas('memberships', fn($mq) => $mq->where('user_id', $userId)->where('status', 'accepted'));
        })->where('is_deleted', false)->where('is_archived', true)->count();
        $trashCount = ResearchProject::where('owner_id', $userId)->where('is_deleted', true)->count();

        $query = ResearchProject::query();

        if ($scope === 'trash') {
            $query->where('owner_id', $userId)->where('is_deleted', true);
        } elseif ($scope === 'owned') {
            $query->where('owner_id', $userId)->where('is_deleted', false)->where('is_archived', false);
        } elseif ($scope === 'shared') {
            $query->where('owner_id', '!=', $userId)
                ->whereHas('memberships', fn($q) => $q->where('user_id', $userId)->where('status', 'accepted'))
                ->where('is_deleted', false)
                ->where('is_archived', false);
        } elseif ($scope === 'archived') {
            $query->where(function ($q) use ($userId) {
                $q->where('owner_id', $userId)
                  ->orWhereHas('memberships', fn($mq) => $mq->where('user_id', $userId)->where('status', 'accepted'));
            })->where('is_deleted', false)->where('is_archived', true);
        } else {
            // Default active (owned + shared)
            $query->where(function ($q) use ($userId) {
                $q->where('owner_id', $userId)
                  ->orWhereHas('memberships', fn($mq) => $mq->where('user_id', $userId)->where('status', 'accepted'));
            })->where('is_deleted', false)->where('is_archived', false);
        }

        if ($request->filled('stage')) {
            $query->where('stage', $request->input('stage'));
        }

        if ($request->filled('tag')) {
            $tag = $request->input('tag');
            $query->whereJsonContains('tags', $tag);
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

        $sort = $request->query('sort', 'recent');
        if ($sort === 'title') {
            $query->orderBy('title', 'asc');
        } elseif ($sort === 'created') {
            $query->orderBy('created_at', 'desc');
        } else {
            $query->orderBy('updated_at', 'desc');
        }

        $projects = $query->with(['owner', 'memberships.user'])
            ->withCount(['evidenceItems', 'resources', 'findings'])
            ->paginate($perPage);

        $enrichedItems = $projects->getCollection()->map(function ($proj) use ($userId) {
            $membership = $proj->memberships->firstWhere('user_id', $userId);
            $myRole = $proj->owner_id === $userId ? 'owner' : ($membership?->role ?? 'viewer');

            // Compute real next_action for project (screens 02 and 04)
            $nextAction = null;
            $candidates = EvidenceItem::where('project_id', $proj->id)->where('state', 'candidate')->count();
            if ($candidates > 0) {
                $nextAction = [
                    'label' => "Review {$candidates} candidate evidence item" . ($candidates > 1 ? 's' : ''),
                    'target' => "/projects/{$proj->id}/evidence?state=candidate",
                ];
            } else {
                $openQ = \App\Models\ProjectQuestion::where('project_id', $proj->id)->where('resolved', false)->first();
                if ($openQ) {
                    $nextAction = [
                        'label' => "Answer open question: {$openQ->text}",
                        'target' => "/projects/{$proj->id}/questions",
                    ];
                } elseif (empty($proj->question)) {
                    $nextAction = [
                        'label' => 'Define research question',
                        'target' => "/projects/{$proj->id}",
                    ];
                }
            }

            return [
                'id' => $proj->id,
                'title' => $proj->title,
                'question' => $proj->question,
                'scope' => $proj->scope,
                'stage' => $proj->stage,
                'is_archived' => $proj->is_archived,
                'is_deleted' => $proj->is_deleted,
                'my_role' => $myRole,
                'evidence_count' => $proj->evidence_items_count,
                'resource_count' => $proj->resources_count,
                'finding_count' => $proj->findings_count,
                'tags' => $proj->tags ?? [],
                'languages' => $proj->languages ?? [$proj->primary_language],
                'last_activity_at' => $proj->updated_at?->toIso8601String(),
                'recovery_deadline' => $proj->recovery_deadline?->toIso8601String(),
                'next_action' => $nextAction,
                'owner' => [
                    'id' => $proj->owner?->id,
                    'display_name' => $proj->owner?->display_name,
                ],
            ];
        });

        return response()->json([
            'success' => true,
            'message' => 'Success',
            'data' => $enrichedItems,
            'meta' => [
                'timestamp' => now()->toIso8601String(),
                'version' => 'v1',
                'pagination' => [
                    'current_page' => $projects->currentPage(),
                    'per_page' => $projects->perPage(),
                    'total_items' => $projects->total(),
                    'total_pages' => $projects->lastPage(),
                    'has_more' => $projects->hasMorePages(),
                ],
                'counts' => [
                    'owned' => $ownedCount,
                    'shared' => $sharedCount,
                    'archived' => $archivedCount,
                    'trash' => $trashCount,
                ],
            ],
        ], 200);
    }

    /**
     * Create a new research project workspace (DEF-6 / API-4).
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        // Enforce DEF-6: only approved researcher accounts can create projects
        if ($user->status !== 'approved' && !$user->is_admin) {
            return $this->errorResponse(
                'Only approved researcher accounts can create research projects. Your application is currently ' . $user->status . '.',
                'ACCOUNT_NOT_APPROVED',
                403
            );
        }

        $validated = $request->validate([
            'title' => [
                'required',
                'string',
                'max:500',
                \Illuminate\Validation\Rule::unique('research_projects', 'title')
                    ->where(fn($q) => $q->where('owner_id', $user->id)->where('is_deleted', false)),
            ],
            'question' => 'nullable|string',
            'scope' => 'nullable|string',
            'primary_language' => 'nullable|string|max:10',
            'languages' => 'nullable|array',
            'languages.*' => 'string|max:10',
            'tags' => 'nullable|array',
            'tags.*' => 'string|max:50',
            'stage' => 'nullable|string|in:scoping,collecting,analysing,writing,reviewing,completed',
        ]);

        $project = DB::transaction(function () use ($user, $validated) {
            $project = ResearchProject::create([
                'owner_id' => $user->id,
                'title' => $validated['title'],
                'question' => $validated['question'] ?? null,
                'scope' => $validated['scope'] ?? null,
                'primary_language' => $validated['primary_language'] ?? ($validated['languages'][0] ?? 'ar'),
                'languages' => $validated['languages'] ?? [$validated['primary_language'] ?? 'ar'],
                'tags' => $validated['tags'] ?? [],
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
            $project->load(['owner:id,display_name', 'memberships.user:id,display_name']),
            'Research project workspace created.',
            201
        );
    }

    /**
     * Get project details and active workspace state.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $project = ResearchProject::find($id);
        if (!$project) {
            return $this->errorResponse('Project not found.', 'NOT_FOUND', 404);
        }

        if ($project->is_deleted) {
            if ($project->owner_id !== $request->user()->id && !$request->user()->is_admin) {
                return $this->errorResponse('Project not found.', 'NOT_FOUND', 404);
            }
            $project->recovery_deadline = $project->deleted_at ? $project->deleted_at->addDays(30)->toIso8601String() : null;
        } else {
            $this->policyService->authorizeProject($request->user(), 'view', $project);
        }

        $project->load(['owner:id,display_name', 'memberships.user:id,display_name']);

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
            'title' => [
                'sometimes',
                'required',
                'string',
                'max:500',
                \Illuminate\Validation\Rule::unique('research_projects', 'title')
                    ->where(fn($q) => $q->where('owner_id', $project->owner_id)->where('is_deleted', false))
                    ->ignore($project->id),
            ],
            'question' => 'sometimes|nullable|string',
            'scope' => 'nullable|string',
            'primary_language' => 'nullable|string|max:10',
            'languages' => 'nullable|array',
            'tags' => 'nullable|array',
            'stage' => 'sometimes|string|in:scoping,collecting,analysing,writing,reviewing,completed',
            'rationale' => 'nullable|string',
        ]);

        if (isset($validated['stage']) && $validated['stage'] !== $project->stage) {
            ProjectActivity::create([
                'project_id' => $project->id,
                'actor_id' => $request->user()->id,
                'action' => 'stage_changed',
                'object_type' => 'project',
                'object_id' => $project->id,
                'summary' => "Stage changed from {$project->stage} to {$validated['stage']}" . (!empty($validated['rationale']) ? " (Rationale: {$validated['rationale']})" : ''),
                'created_at' => now(),
            ]);
        }

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

        if ($validated['stage'] !== $project->stage) {
            ProjectActivity::create([
                'project_id' => $project->id,
                'actor_id' => $request->user()->id,
                'action' => 'stage_changed',
                'object_type' => 'project',
                'object_id' => $project->id,
                'summary' => "Stage changed from {$project->stage} to {$validated['stage']}" . (!empty($validated['rationale']) ? " (Rationale: {$validated['rationale']})" : ''),
                'created_at' => now(),
            ]);
        }

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

        if ($request->has('archived')) {
            $isArchived = $request->boolean('archived');
        } else {
            $isArchived = !$project->is_archived;
        }

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

        return $this->successResponse(null, 'Project moved to trash with a 30-day recovery deadline.');
    }

    /**
     * Restore a trashed project (API-4 / PRJ-07).
     */
    public function restore(Request $request, int $id): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', true)->find($id);
        if (!$project) {
            return $this->errorResponse('Trashed project not found.', 'NOT_FOUND', 404);
        }

        if ($project->owner_id !== $request->user()->id && !$request->user()->is_admin) {
            return $this->errorResponse('Only the project owner can restore a trashed project.', 'FORBIDDEN', 403);
        }

        $project->update([
            'is_deleted' => false,
            'deleted_at' => null,
            'recovery_deadline' => null,
        ]);

        return $this->successResponse($project, 'Project restored successfully.');
    }

    /**
     * Leave a shared project (API-4).
     */
    public function leave(Request $request, int $id): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->find($id);
        if (!$project) {
            return $this->errorResponse('Project not found.', 'NOT_FOUND', 404);
        }

        $userId = $request->user()->id;
        if ($project->owner_id === $userId) {
            return $this->errorResponse('Project owner cannot leave their own project. Transfer ownership first.', 'CONFLICT', 409);
        }

        $membership = ProjectMembership::where('project_id', $project->id)
            ->where('user_id', $userId)
            ->first();

        if ($membership) {
            $membership->delete();
        }

        return $this->successResponse(null, 'You have left the project.');
    }

    /**
     * Comprehensive project summary with state counts (API-4 / PRJ-05).
     */
    public function summary(Request $request, int $id): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->find($id);
        if (!$project) {
            return $this->errorResponse('Project not found.', 'NOT_FOUND', 404);
        }

        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $evidenceCounts = [
            'candidate' => EvidenceItem::where('project_id', $project->id)->where('state', 'candidate')->count(),
            'included' => EvidenceItem::where('project_id', $project->id)->where('state', 'included')->count(),
            'reviewed' => EvidenceItem::where('project_id', $project->id)->where('state', 'reviewed')->count(),
            'excluded' => EvidenceItem::where('project_id', $project->id)->where('state', 'excluded')->count(),
            'unresolved' => EvidenceItem::where('project_id', $project->id)->where('state', 'unresolved')->count(),
            'total' => EvidenceItem::where('project_id', $project->id)->count(),
        ];

        return $this->successResponse([
            'project_id' => $project->id,
            'title' => $project->title,
            'stage' => $project->stage,
            'evidence_counts' => $evidenceCounts,
            'resources_count' => ProjectResource::where('project_id', $project->id)->count(),
            'saved_searches_count' => SavedQuery::where('owner_type', 'project')->where('owner_id', $project->id)->count(),
            'result_sets_count' => \App\Models\ResultSet::where('project_id', $project->id)->count(),
            'analyses_count' => AnalysisRun::where('project_id', $project->id)->count(),
            'findings_count' => Finding::where('project_id', $project->id)->count(),
            'documents_count' => Document::where('project_id', $project->id)->count(),
            'open_tasks_count' => Task::where('project_id', $project->id)->where('status', 'open')->count(),
            'last_activity_at' => $project->updated_at?->toIso8601String(),
        ]);
    }

    /**
     * List project members enriched with contribution summary (API-11).
     */
    public function members(Request $request, int $id): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->find($id);
        if (!$project) {
            return $this->errorResponse('Project not found.', 'NOT_FOUND', 404);
        }

        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $status = $request->input('status', 'accepted');
        $query = ProjectMembership::where('project_id', $project->id);
        if ($status !== 'all') {
            $query->where('status', $status);
        }

        $members = $query->with(['user.profile'])->get();

        $enriched = $members->map(function ($m) use ($project) {
            $uId = $m->user_id;
            return [
                'id' => $m->id,
                'user_id' => $uId,
                'role' => $m->role,
                'status' => $m->status,
                'joined_at' => $m->accepted_at ?? $m->created_at,
                'invited_by' => $m->invited_by,
                'user' => [
                    'id' => $m->user?->id,
                    'display_name' => $m->user?->display_name,
                    'affiliation' => $m->user?->profile?->affiliation,
                ],
                'contribution_summary' => [
                    'evidence_items' => EvidenceItem::where('project_id', $project->id)->where('collector_id', $uId)->count(),
                    'documents' => DocumentVersion::whereIn('document_id', Document::where('project_id', $project->id)->select('id'))->where('author_id', $uId)->count(),
                    'comments' => Comment::where('author_id', $uId)->whereIn('thread_id', \App\Models\DiscussionThread::where('project_id', $project->id)->select('id'))->count(),
                    'tasks' => Task::where('project_id', $project->id)->where('assignee_id', $uId)->count(),
                ],
            ];
        });

        return $this->successResponse($enriched);
    }

    public function addMember(Request $request, int $id): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->find($id);
        if (!$project) {
            return $this->errorResponse('Project not found.', 'NOT_FOUND', 404);
        }

        $this->policyService->authorizeProject($request->user(), 'manage_members', $project);

        $validated = $request->validate([
            'user_id' => 'required|integer|exists:users,id',
            'role' => 'required|string|in:researcher,reviewer,viewer',
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

        return $this->successResponse($membership, 'Member role updated.');
    }

    // ------------------------------------------------------------------------
    // Milestones (API-4)
    // ------------------------------------------------------------------------

    public function listMilestones(Request $request, int $id): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($id);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $milestones = ProjectMilestone::where('project_id', $project->id)
            ->orderBy('due_date', 'asc')
            ->get();

        return $this->successResponse($milestones);
    }

    public function storeMilestone(Request $request, int $id): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($id);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'due_date' => 'nullable|date',
            'progress_mode' => 'nullable|string|in:computed,manual',
            'manual_percent' => 'nullable|integer|min:0|max:100',
            'computed_basis' => 'nullable|string',
        ]);

        $milestone = ProjectMilestone::create([
            'project_id' => $project->id,
            'title' => $validated['title'],
            'due_date' => $validated['due_date'] ?? null,
            'progress_mode' => $validated['progress_mode'] ?? 'manual',
            'manual_percent' => $validated['manual_percent'] ?? 0,
            'computed_basis' => $validated['computed_basis'] ?? null,
            'status' => 'pending',
        ]);

        return $this->successResponse($milestone, 'Milestone created.', 201);
    }

    public function updateMilestone(Request $request, int $id, int $milestoneId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($id);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $milestone = ProjectMilestone::where('project_id', $project->id)->findOrFail($milestoneId);

        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'due_date' => 'nullable|date',
            'progress_mode' => 'nullable|string|in:computed,manual',
            'manual_percent' => 'nullable|integer|min:0|max:100',
            'status' => 'sometimes|string|in:pending,in_progress,completed',
            'computed_basis' => 'nullable|string',
        ]);

        $milestone->update($validated);

        return $this->successResponse($milestone, 'Milestone updated.');
    }

    public function destroyMilestone(Request $request, int $id, int $milestoneId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($id);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $milestone = ProjectMilestone::where('project_id', $project->id)->findOrFail($milestoneId);
        $milestone->delete();

        return $this->successResponse(null, 'Milestone deleted.');
    }

    // ------------------------------------------------------------------------
    // Open Research Questions (API-4)
    // ------------------------------------------------------------------------

    public function listQuestions(Request $request, int $id): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($id);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $questions = ProjectQuestion::where('project_id', $project->id)
            ->latest('created_at')
            ->get();

        return $this->successResponse($questions);
    }

    public function storeQuestion(Request $request, int $id): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($id);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $validated = $request->validate([
            'text' => 'required|string',
            'linked_evidence_ids' => 'nullable|array',
            'linked_evidence_ids.*' => 'integer',
        ]);

        $question = ProjectQuestion::create([
            'project_id' => $project->id,
            'text' => $validated['text'],
            'linked_evidence_ids' => $validated['linked_evidence_ids'] ?? [],
            'resolved' => false,
        ]);

        return $this->successResponse($question, 'Research question recorded.', 201);
    }

    public function updateQuestion(Request $request, int $id, int $questionId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($id);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $question = ProjectQuestion::where('project_id', $project->id)->findOrFail($questionId);

        $validated = $request->validate([
            'text' => 'sometimes|required|string',
            'linked_evidence_ids' => 'nullable|array',
            'resolved' => 'sometimes|boolean',
        ]);

        $question->update($validated);

        return $this->successResponse($question, 'Research question updated.');
    }

    public function destroyQuestion(Request $request, int $id, int $questionId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($id);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $question = ProjectQuestion::where('project_id', $project->id)->findOrFail($questionId);
        $question->delete();

        return $this->successResponse(null, 'Research question deleted.');
    }

    // ------------------------------------------------------------------------
    // Copy to Project (PRJ-06)
    // ------------------------------------------------------------------------

    public function copyPreview(Request $request, int $id): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($id);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $validated = $request->validate([
            'target_project_id' => 'required|integer|exists:research_projects,id',
            'items' => 'required|array|min:1',
            'items.*.type' => 'required|string|in:resource,saved_query,analysis',
            'items.*.id' => 'required|integer',
        ]);

        $targetProject = ResearchProject::where('is_deleted', false)->findOrFail($validated['target_project_id']);
        $this->policyService->authorizeProject($request->user(), 'edit', $targetProject);

        $preview = collect($validated['items'])->map(function ($item) {
            return [
                'type' => $item['type'],
                'id' => $item['id'],
                'can_copy' => true,
                'note' => 'Provenance recorded. Membership, private notes and publication authority will not be copied.',
            ];
        });

        return $this->successResponse($preview);
    }

    public function copy(Request $request, int $id): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($id);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $validated = $request->validate([
            'target_project_id' => 'required|integer|exists:research_projects,id',
            'items' => 'required|array|min:1',
            'items.*.type' => 'required|string|in:resource,saved_query,analysis',
            'items.*.id' => 'required|integer',
        ]);

        $targetProject = ResearchProject::where('is_deleted', false)->findOrFail($validated['target_project_id']);
        $this->policyService->authorizeProject($request->user(), 'edit', $targetProject);

        $results = [];

        foreach ($validated['items'] as $item) {
            if ($item['type'] === 'resource') {
                $src = ProjectResource::where('project_id', $project->id)->where('resource_id', $item['id'])->first();
                if ($src) {
                    $newRes = ProjectResource::firstOrCreate([
                        'project_id' => $targetProject->id,
                        'resource_id' => $src->resource_id,
                    ], [
                        'added_by' => $request->user()->id,
                        'inclusion_rationale' => $src->inclusion_rationale,
                        'tags' => $src->tags,
                        'origin' => ['type' => 'copy', 'ref' => "PRJ-{$project->id}", 'at' => now()->toIso8601String()],
                    ]);
                    $results[] = ['type' => 'resource', 'id' => $src->resource_id, 'status' => 'copied'];
                }
            } elseif ($item['type'] === 'saved_query') {
                $srcQ = SavedQuery::where('owner_type', 'project')->where('owner_id', $project->id)->find($item['id']);
                if ($srcQ) {
                    SavedQuery::create([
                        'owner_type' => 'project',
                        'owner_id' => $targetProject->id,
                        'name' => $srcQ->name . ' (Copied)',
                        'query_text' => $srcQ->query_text,
                        'search_mode' => $srcQ->search_mode,
                        'filter_criteria' => $srcQ->filter_criteria,
                    ]);
                    $results[] = ['type' => 'saved_query', 'id' => $srcQ->id, 'status' => 'copied'];
                }
            }
        }

        return $this->successResponse($results, 'Selected items copied to target project.');
    }

    // ------------------------------------------------------------------------
    // Ownership Transfer (API-11 / PRJ-07)
    // ------------------------------------------------------------------------

    public function transfer(Request $request, int $id): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($id);

        if ($project->owner_id !== $request->user()->id && !$request->user()->is_admin) {
            return $this->errorResponse('Only the project owner can initiate ownership transfer.', 'FORBIDDEN', 403);
        }

        $validated = $request->validate([
            'user_id' => 'required|integer|exists:users,id',
        ]);

        $transfer = ProjectTransfer::create([
            'project_id' => $project->id,
            'source_owner_id' => $project->owner_id,
            'target_owner_id' => $validated['user_id'],
            'status' => 'pending',
            'created_at' => now(),
        ]);

        return $this->successResponse($transfer, 'Ownership transfer initiated. Pending target researcher acceptance.');
    }

    public function acceptTransfer(Request $request, int $id): JsonResponse
    {
        $transfer = ProjectTransfer::where('project_id', $id)
            ->where('target_owner_id', $request->user()->id)
            ->where('status', 'pending')
            ->firstOrFail();

        $project = ResearchProject::findOrFail($id);

        DB::transaction(function () use ($transfer, $project) {
            $oldOwnerId = $project->owner_id;
            $newOwnerId = $transfer->target_owner_id;

            $project->update(['owner_id' => $newOwnerId]);

            // Demote old owner to researcher
            ProjectMembership::where('project_id', $project->id)
                ->where('user_id', $oldOwnerId)
                ->update(['role' => 'researcher']);

            // Promote new owner to owner
            ProjectMembership::updateOrCreate(
                ['project_id' => $project->id, 'user_id' => $newOwnerId],
                ['role' => 'owner', 'status' => 'accepted']
            );

            $transfer->update([
                'status' => 'accepted',
                'decided_at' => now(),
            ]);
        });

        return $this->successResponse(null, 'Ownership transfer accepted.');
    }

    public function declineTransfer(Request $request, int $id): JsonResponse
    {
        $transfer = ProjectTransfer::where('project_id', $id)
            ->where('target_owner_id', $request->user()->id)
            ->where('status', 'pending')
            ->firstOrFail();

        $transfer->update([
            'status' => 'declined',
            'decided_at' => now(),
        ]);

        return $this->successResponse(null, 'Ownership transfer declined.');
    }
}
