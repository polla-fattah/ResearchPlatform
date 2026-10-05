<?php

namespace App\Http\Controllers\Api;

use App\Models\ResearchProject;
use App\Models\ProjectMembership;
use App\Models\ProjectInvitation;
use App\Models\DiscussionThread;
use App\Models\Comment;
use App\Models\Task;
use App\Models\ProjectActivity;
use App\Models\Notification;
use App\Models\Document;
use App\Models\User;
use App\Services\AuthPolicyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CollaborationController extends ApiController
{
    public function __construct(
        protected AuthPolicyService $policy
    ) {}

    // ------------------------------------------------------------------------
    // 1. INVITATIONS & MEMBER MANAGEMENT (COL-01, COL-02)
    // ------------------------------------------------------------------------

    public function listInvitations(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policy->authorizeProject($request->user(), 'manage_members', $project);

        $perPage = min((int)$request->input('per_page', 20), 100);
        $invitations = ProjectInvitation::where('project_id', $project->id)
            ->with(['inviter:id,display_name,email'])
            ->orderBy('created_at', 'desc')
            ->paginate($perPage);

        return $this->paginatedResponse($invitations);
    }

    public function createInvitation(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policy->authorizeProject($request->user(), 'invite', $project);

        $validated = $request->validate([
            'email' => 'required|email|max:255',
            'role' => 'required|string|in:researcher,reviewer,viewer',
            'expires_days' => 'nullable|integer|min:1|max:30',
        ]);

        $role = $validated['role'];

        $invitedUser = User::where('email', $validated['email'])->first();

        // Check if already active member
        if ($invitedUser) {
            $existing = ProjectMembership::where('project_id', $project->id)
                ->where('user_id', $invitedUser->id)
                ->where('status', 'accepted')
                ->first();

            if ($existing) {
                return $this->errorResponse('This researcher is already an active member of this project.', 'CONFLICT', 409);
            }
        }

        // Check for pending invitation conflict (API-11)
        $pendingInvite = ProjectInvitation::where('project_id', $project->id)
            ->where('email', $validated['email'])
            ->where('status', 'pending')
            ->first();

        if ($pendingInvite && !$pendingInvite->isExpired()) {
            return $this->errorResponse('This researcher already has a pending invitation for this project.', 'CONFLICT', 409);
        }

        $days = $validated['expires_days'] ?? 7;
        $invitation = ProjectInvitation::create([
            'project_id' => $project->id,
            'email' => $validated['email'],
            'invited_user_id' => $invitedUser?->id,
            'role' => $role,
            'token' => Str::random(64),
            'status' => 'pending',
            'expires_at' => now()->addDays($days),
            'invited_by' => $request->user()->id,
            'created_at' => now(),
        ]);

        // Record activity
        ProjectActivity::create([
            'project_id' => $project->id,
            'actor_id' => $request->user()->id,
            'action' => 'invitation_created',
            'object_type' => 'invitation',
            'object_id' => $invitation->id,
            'summary' => "Invited {$validated['email']} as " . ucfirst($role),
            'created_at' => now(),
        ]);

        // Dispatch notification if invited user exists on platform
        if ($invitedUser) {
            Notification::create([
                'user_id' => $invitedUser->id,
                'type' => 'invitation',
                'title' => 'Project Invitation Received',
                'message' => "You have been invited to join '{$project->title}' as {$role}.",
                'target_type' => 'project',
                'target_id' => $project->id,
                'created_at' => now(),
            ]);
        }

        return $this->success($invitation, 'Invitation sent successfully.', 201);
    }

    public function acceptInvitation(Request $request, string $token): JsonResponse
    {
        $invitation = ProjectInvitation::where('token', $token)->firstOrFail();

        if ($invitation->status !== 'pending') {
            return $this->error("This invitation has already been {$invitation->status}.", 400);
        }

        if ($invitation->isExpired()) {
            $invitation->update(['status' => 'expired']);
            return $this->error('This invitation has expired.', 410);
        }

        $user = $request->user();

        // Enforce email matching or user ID matching
        if (strtolower($user->email) !== strtolower($invitation->email) && $invitation->invited_user_id !== $user->id) {
            return $this->error('This invitation was sent to a different email address.', 403);
        }

        $project = $invitation->project;

        // Upsert project membership
        $membership = ProjectMembership::updateOrCreate(
            ['project_id' => $project->id, 'user_id' => $user->id],
            [
                'role' => $invitation->role,
                'status' => 'accepted',
                'invited_by' => $invitation->invited_by,
                'accepted_at' => now(),
                'revoked_at' => null,
            ]
        );

        $invitation->update([
            'status' => 'accepted',
            'accepted_at' => now(),
            'invited_user_id' => $user->id,
        ]);

        // Activity log
        ProjectActivity::create([
            'project_id' => $project->id,
            'actor_id' => $user->id,
            'action' => 'member_joined',
            'object_type' => 'membership',
            'object_id' => $membership->id,
            'summary' => "{$user->display_name} joined the project as " . ucfirst($invitation->role),
            'created_at' => now(),
        ]);

        // Notify Project Owner
        if ($project->owner_id !== $user->id) {
            Notification::create([
                'user_id' => $project->owner_id,
                'type' => 'invitation_accepted',
                'title' => 'Researcher Joined Project',
                'message' => "{$user->display_name} accepted the invitation to join '{$project->title}'.",
                'target_type' => 'project',
                'target_id' => $project->id,
                'created_at' => now(),
            ]);
        }

        return $this->success($membership, 'You have successfully joined the research project.');
    }

    public function getInvitationPreview(string $token): JsonResponse
    {
        $invitation = ProjectInvitation::with(['project', 'inviter:id,display_name'])
            ->where('token', $token)
            ->first();

        if (!$invitation) {
            return $this->errorResponse('Invitation not found.', 'NOT_FOUND', 404);
        }

        return $this->success([
            'token' => $invitation->token,
            'project_id' => $invitation->project_id,
            'project_title' => $invitation->project?->title,
            'inviter' => $invitation->inviter?->display_name ?? 'A researcher',
            'role' => $invitation->role,
            'status' => $invitation->status,
            'expires_at' => $invitation->expires_at?->toIso8601String(),
            'is_expired' => $invitation->isExpired(),
        ]);
    }

    public function resendInvitation(Request $request, int $projectId, int $invitationId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policy->authorizeProject($request->user(), 'manage_members', $project);

        $invitation = ProjectInvitation::where('project_id', $project->id)->findOrFail($invitationId);

        $invitation->update([
            'token' => Str::random(64),
            'status' => 'pending',
            'expires_at' => now()->addDays(7),
        ]);

        return $this->success($invitation, 'Invitation resent successfully.');
    }

    public function destroyInvitation(Request $request, int $projectId, int $invitationId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policy->authorizeProject($request->user(), 'manage_members', $project);

        $invitation = ProjectInvitation::where('project_id', $project->id)->findOrFail($invitationId);
        $invitation->delete();

        return $this->success(null, 'Invitation withdrawn.');
    }

    public function declineInvitation(Request $request, string $token): JsonResponse
    {
        $invitation = ProjectInvitation::where('token', $token)->firstOrFail();

        if ($invitation->status !== 'pending') {
            return $this->error("This invitation is already {$invitation->status}.", 400);
        }

        $invitation->update(['status' => 'declined']);
        return $this->success(null, 'Invitation declined.');
    }

    public function updateMemberRole(Request $request, int $projectId, int $userId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policy->authorizeProject($request->user(), 'manage_members', $project);

        if ($userId === $project->owner_id) {
            return $this->error('The project owner role cannot be modified here.', 422);
        }

        $validated = $request->validate([
            'role' => 'required|string|in:owner,researcher,reviewer,viewer,co_investigator,contributor,observer',
        ]);

        $role = match ($validated['role']) {
            'co_investigator', 'contributor' => 'researcher',
            'observer' => 'viewer',
            default => $validated['role'],
        };

        $membership = ProjectMembership::where('project_id', $project->id)
            ->where('user_id', $userId)
            ->firstOrFail();

        $oldRole = $membership->role;
        $membership->update([
            'role' => $role,
            'status' => 'accepted',
        ]);

        // Immediate activity & notification
        ProjectActivity::create([
            'project_id' => $project->id,
            'actor_id' => $request->user()->id,
            'action' => 'role_changed',
            'object_type' => 'membership',
            'object_id' => $membership->id,
            'summary' => "Changed role of {$membership->user->display_name} from {$oldRole} to {$role}",
            'created_at' => now(),
        ]);

        Notification::create([
            'user_id' => $userId,
            'type' => 'role_updated',
            'title' => 'Project Role Updated',
            'message' => "Your role in '{$project->title}' was changed to {$role}.",
            'target_type' => 'project',
            'target_id' => $project->id,
            'created_at' => now(),
        ]);

        return $this->success($membership, 'Member role updated successfully.');
    }

    public function removeMember(Request $request, int $projectId, int $userId): JsonResponse
    {
        $project = ResearchProject::findOrFail($projectId);
        $this->policy->authorizeProject($request->user(), 'manage_members', $project);

        if ($userId === $project->owner_id) {
            return $this->error('The project owner cannot be removed from their own project.', 422);
        }

        $membership = ProjectMembership::where('project_id', $project->id)
            ->where('user_id', $userId)
            ->firstOrFail();

        $membership->update([
            'status' => 'revoked',
            'revoked_at' => now(),
        ]);

        ProjectActivity::create([
            'project_id' => $project->id,
            'actor_id' => $request->user()->id,
            'action' => 'member_removed',
            'object_type' => 'membership',
            'object_id' => $membership->id,
            'summary' => "Revoked membership of {$membership->user->display_name}",
            'created_at' => now(),
        ]);

        return $this->success(null, 'Member access revoked immediately.');
    }

    // ------------------------------------------------------------------------
    // 2. CONTEXTUAL DISCUSSIONS & DISPUTE THREADS (COL-03, COL-07)
    // ------------------------------------------------------------------------

    public function listDiscussions(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policy->authorizeProject($request->user(), 'view', $project);

        $query = DiscussionThread::where('project_id', $project->id)
            ->with(['resolver:id,display_name'])
            ->withCount('comments');

        if ($request->has('target_type') && $request->has('target_id')) {
            $query->where('target_type', $request->query('target_type'))
                  ->where('target_id', $request->query('target_id'));
        }

        if ($request->has('thread_type')) {
            $query->where('thread_type', $request->query('thread_type'));
        }

        if ($request->has('is_resolved')) {
            $query->where('is_resolved', filter_var($request->query('is_resolved'), FILTER_VALIDATE_BOOLEAN));
        }

        $perPage = min((int)$request->input('per_page', 20), 100);
        $threads = $query->orderBy('updated_at', 'desc')->paginate($perPage);
        return $this->paginatedResponse($threads);
    }

    public function createDiscussion(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policy->authorizeProject($request->user(), 'discuss', $project);

        $validated = $request->validate([
            'title' => 'required|string|max:500',
            'thread_type' => 'nullable|string|in:discussion,dispute_review',
            'target_type' => 'required|string|in:project,evidence,analysis,finding,document,passage',
            'target_id' => 'required|integer',
            'context_quote' => 'nullable|string',
            'context_locator' => 'nullable|string|max:255',
            'initial_comment' => 'required|string',
        ]);

        $thread = DiscussionThread::create([
            'project_id' => $project->id,
            'thread_type' => $validated['thread_type'] ?? 'discussion',
            'target_type' => $validated['target_type'],
            'target_id' => $validated['target_id'],
            'title' => $validated['title'],
            'context_quote' => $validated['context_quote'] ?? null,
            'context_locator' => $validated['context_locator'] ?? null,
            'is_resolved' => false,
        ]);

        $comment = Comment::create([
            'thread_id' => $thread->id,
            'author_id' => $request->user()->id,
            'content' => $validated['initial_comment'],
        ]);

        // Record activity
        ProjectActivity::create([
            'project_id' => $project->id,
            'actor_id' => $request->user()->id,
            'action' => 'discussion_opened',
            'object_type' => 'discussion_thread',
            'object_id' => $thread->id,
            'summary' => "Opened {$thread->thread_type}: '{$thread->title}'",
            'created_at' => now(),
        ]);

        return $this->success($thread->load('comments'), 'Discussion thread opened.', 201);
    }

    public function listComments(Request $request, int $threadId): JsonResponse
    {
        $thread = DiscussionThread::with('project')->findOrFail($threadId);
        $this->policy->authorizeProject($request->user(), 'view', $thread->project);

        $perPage = min((int)$request->input('per_page', 20), 100);
        $comments = Comment::where('thread_id', $thread->id)
            ->with(['author:id,display_name'])
            ->orderBy('created_at', 'asc')
            ->paginate($perPage);

        return $this->paginatedResponse($comments);
    }

    public function addComment(Request $request, int $threadId): JsonResponse
    {
        $thread = DiscussionThread::with('project')->findOrFail($threadId);
        $this->policy->authorizeProject($request->user(), 'discuss', $thread->project);

        $validated = $request->validate([
            'content' => 'required|string|min:1',
        ]);

        $comment = Comment::create([
            'thread_id' => $thread->id,
            'author_id' => $request->user()->id,
            'content' => $validated['content'],
        ]);

        $thread->touch(); // updates updated_at

        return $this->success($comment->load('author:id,display_name'), 'Comment posted.', 201);
    }

    public function resolveDiscussion(Request $request, int $threadId): JsonResponse
    {
        $thread = DiscussionThread::with('project')->findOrFail($threadId);
        $this->policy->authorizeProject($request->user(), 'resolve_dispute', $thread->project);

        $validated = $request->validate([
            'resolution_notes' => 'required|string|min:3',
            'alternative_interpretation' => 'nullable|string',
        ]);

        $thread->update([
            'is_resolved' => true,
            'resolution_notes' => $validated['resolution_notes'],
            'alternative_interpretation' => $validated['alternative_interpretation'] ?? null,
            'resolved_by' => $request->user()->id,
            'resolved_at' => now(),
        ]);

        ProjectActivity::create([
            'project_id' => $thread->project_id,
            'actor_id' => $request->user()->id,
            'action' => 'discussion_resolved',
            'object_type' => 'discussion_thread',
            'object_id' => $thread->id,
            'summary' => "Resolved thread '{$thread->title}'",
            'created_at' => now(),
        ]);

        return $this->success($thread->fresh('resolver:id,display_name'), 'Thread resolved with recorded scholarly rationale.');
    }

    // ------------------------------------------------------------------------
    // 3. RESEARCH TASK MANAGEMENT (COL-04)
    // ------------------------------------------------------------------------

    public function listTasks(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policy->authorizeProject($request->user(), 'view', $project);

        $query = Task::where('project_id', $project->id)
            ->with(['assignee:id,display_name']);

        if ($request->has('status')) {
            $query->where('status', $request->query('status'));
        }

        if ($request->has('assignee_id')) {
            $query->where('assignee_id', $request->query('assignee_id'));
        }

        $perPage = min((int)$request->input('per_page', 20), 100);
        $tasks = $query->orderBy('created_at', 'desc')->paginate($perPage);
        return $this->paginatedResponse($tasks);
    }

    public function createTask(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::findOrFail($projectId);
        $this->policy->authorizeProject($request->user(), 'manage_tasks', $project);

        $validated = $request->validate([
            'title' => 'required|string|max:500',
            'description' => 'nullable|string',
            'assignee_id' => 'nullable|integer|exists:users,id',
            'due_date' => 'nullable|date',
        ]);

        $task = Task::create([
            'project_id' => $project->id,
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
            'assignee_id' => $validated['assignee_id'] ?? null,
            'due_date' => $validated['due_date'] ?? null,
            'status' => 'open',
        ]);

        ProjectActivity::create([
            'project_id' => $project->id,
            'actor_id' => $request->user()->id,
            'action' => 'task_created',
            'object_type' => 'task',
            'object_id' => $task->id,
            'summary' => "Created task: '{$task->title}'",
            'created_at' => now(),
        ]);

        if (!empty($validated['assignee_id']) && $validated['assignee_id'] !== $request->user()->id) {
            Notification::create([
                'user_id' => $validated['assignee_id'],
                'type' => 'assignment',
                'title' => 'New Task Assigned',
                'message' => "You were assigned to '{$task->title}' in '{$project->title}'.",
                'target_type' => 'task',
                'target_id' => $task->id,
                'created_at' => now(),
            ]);
        }

        return $this->success($task->load('assignee:id,display_name'), 'Task created.', 201);
    }

    public function updateTask(Request $request, int $projectId, int $taskId): JsonResponse
    {
        $project = ResearchProject::findOrFail($projectId);
        $this->policy->authorizeProject($request->user(), 'view', $project);

        $task = Task::where('project_id', $project->id)->findOrFail($taskId);

        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:500',
            'description' => 'nullable|string',
            'assignee_id' => 'nullable|integer|exists:users,id',
            'due_date' => 'nullable|date',
            'status' => 'sometimes|required|string|in:open,in_progress,blocked,done',
        ]);

        $task->update($validated);
        return $this->success($task->load('assignee:id,display_name'), 'Task updated.');
    }

    public function completeTask(Request $request, int $projectId, int $taskId): JsonResponse
    {
        $project = ResearchProject::findOrFail($projectId);
        $this->policy->authorizeProject($request->user(), 'view', $project);

        $task = Task::where('project_id', $project->id)->findOrFail($taskId);
        $task->update([
            'status' => 'done',
            'completed_at' => now(),
            'blocking_reason' => null,
        ]);

        ProjectActivity::create([
            'project_id' => $project->id,
            'actor_id' => $request->user()->id,
            'action' => 'task_completed',
            'object_type' => 'task',
            'object_id' => $task->id,
            'summary' => "Completed task: '{$task->title}'",
            'created_at' => now(),
        ]);

        return $this->success($task, 'Task marked as completed.');
    }

    public function blockTask(Request $request, int $projectId, int $taskId): JsonResponse
    {
        $project = ResearchProject::findOrFail($projectId);
        $this->policy->authorizeProject($request->user(), 'view', $project);

        $validated = $request->validate([
            'blocking_reason' => 'required|string|min:3',
        ]);

        $task = Task::where('project_id', $project->id)->findOrFail($taskId);
        $task->update([
            'status' => 'blocked',
            'blocking_reason' => $validated['blocking_reason'],
        ]);

        return $this->success($task, 'Task marked as blocked.');
    }

    // ------------------------------------------------------------------------
    // 4. PROJECT ACTIVITY FEED (COL-08)
    // ------------------------------------------------------------------------

    public function listActivity(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policy->authorizeProject($request->user(), 'view', $project);

        $query = ProjectActivity::where('project_id', $project->id)
            ->with(['actor:id,display_name']);

        if ($request->filled('action')) {
            $query->where('action', $request->query('action'));
        }

        if ($request->filled('actor_id')) {
            $query->where('actor_id', $request->query('actor_id'));
        }

        if ($request->filled('object_type')) {
            $query->where('object_type', $request->query('object_type'));
        }

        if ($request->filled('from')) {
            $query->where('created_at', '>=', $request->query('from'));
        }

        if ($request->filled('to')) {
            $query->where('created_at', '<=', $request->query('to'));
        }

        $perPage = min((int)$request->input('per_page', 20), 100);
        $activities = $query->orderBy('created_at', 'desc')->paginate($perPage);

        if ($activities->total() === 0) {
            $auditLogs = \App\Models\AuditEvent::where(function ($q) use ($project) {
                $q->where(fn($sub) => $sub->where('object_type', 'project')->where('object_id', $project->id))
                  ->orWhereRaw("details->>'project_id' = ?", [(string) $project->id]);
            })->with('actor:id,display_name')->latest('created_at')->paginate($perPage);

            if ($auditLogs->total() > 0) {
                $mapped = $auditLogs->getCollection()->map(function ($log) {
                    return [
                        'id' => $log->id,
                        'project_id' => $log->object_id,
                        'actor_id' => $log->actor_id,
                        'action' => $log->action,
                        'object_type' => $log->object_type,
                        'object_id' => $log->object_id,
                        'summary' => $log->details['summary'] ?? "Action: {$log->action}",
                        'created_at' => $log->created_at?->toIso8601String(),
                        'actor' => $log->actor ? [
                            'id' => $log->actor->id,
                            'display_name' => $log->actor->display_name,
                        ] : null,
                    ];
                });

                return response()->json([
                    'success' => true,
                    'message' => 'Success',
                    'data' => $mapped,
                    'meta' => [
                        'timestamp' => now()->toIso8601String(),
                        'version' => 'v1',
                        'pagination' => [
                            'current_page' => $auditLogs->currentPage(),
                            'per_page' => $auditLogs->perPage(),
                            'total_items' => $auditLogs->total(),
                            'total_pages' => $auditLogs->lastPage(),
                            'has_more' => $auditLogs->hasMorePages(),
                        ],
                    ],
                ]);
            }
        }

        return $this->paginatedResponse($activities);
    }

    public function listThreads(Request $request, int $projectId): JsonResponse
    {
        return $this->listDiscussions($request, $projectId);
    }

    public function createThread(Request $request, int $projectId): JsonResponse
    {
        return $this->createDiscussion($request, $projectId);
    }

    public function getProjectRoles(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policy->authorizeProject($request->user(), 'view', $project);

        return $this->success($this->policy->getRoleCapabilities());
    }

    /**
     * Search users for invitation without leaking emails (API-11).
     */
    public function searchUsers(Request $request): JsonResponse
    {
        $q = trim((string)$request->query('q', ''));
        if (mb_strlen($q) < 3) {
            return $this->errorResponse('Search query must be at least 3 characters.', 'VALIDATION_ERROR', 422);
        }

        $users = User::where('status', 'approved')
            ->where(function ($query) use ($q) {
                $query->where('display_name', 'ilike', "%{$q}%")
                      ->orWhere('email', '=', $q); // Only match exact email
            })
            ->with('profile')
            ->limit(20)
            ->get()
            ->map(function ($u) use ($q) {
                return [
                    'id' => $u->id,
                    'display_name' => $u->display_name,
                    'affiliation' => $u->profile?->affiliation,
                    'email' => strtolower($u->email) === strtolower($q) ? $u->email : null,
                ];
            });

        return $this->success($users);
    }

    // ------------------------------------------------------------------------
    // 5. CONCURRENT EDIT LOCKING (COL-06)
    // ------------------------------------------------------------------------

    public function acquireDocumentLock(Request $request, int $projectId, int $docId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policy->authorizeProject($request->user(), 'acquire_lock', $project);

        $document = Document::where('project_id', $project->id)->findOrFail($docId);
        $userId = $request->user()->id;

        // Lock timeout: 15 minutes
        $lockExpired = $document->locked_at && $document->locked_at->diffInMinutes(now()) >= 15;

        if ($document->locked_by && $document->locked_by !== $userId && !$lockExpired) {
            $lockedUser = User::find($document->locked_by);
            $expiresAt = $document->locked_at->addMinutes(15)->toIso8601String();
            return $this->errorResponse(
                "Document is currently locked by {$lockedUser?->display_name}. Lock expires at {$expiresAt}",
                'LOCKED',
                423,
                [
                    'locked_by' => $document->locked_by,
                    'locked_by_name' => $lockedUser?->display_name ?? 'Unknown',
                    'expires_at' => $expiresAt,
                ]
            );
        }

        $document->update([
            'locked_by' => $userId,
            'locked_at' => now(),
        ]);

        return $this->success([
            'document_id' => $document->id,
            'locked_by' => $userId,
            'locked_at' => $document->locked_at,
            'lock_version' => $document->lock_version,
            'expires_at' => now()->addMinutes(15)->toIso8601String(),
        ], 'Edit lock acquired.');
    }

    public function releaseDocumentLock(Request $request, int $projectId, int $docId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policy->authorizeProject($request->user(), 'view', $project);

        $document = Document::where('project_id', $project->id)->findOrFail($docId);
        $userId = $request->user()->id;

        if ($document->locked_by && $document->locked_by !== $userId && $project->owner_id !== $userId) {
            return $this->error('Only the lock holder or project owner can release this lock.', 403);
        }

        $document->update([
            'locked_by' => null,
            'locked_at' => null,
        ]);

        return $this->success(null, 'Edit lock released.');
    }
}
