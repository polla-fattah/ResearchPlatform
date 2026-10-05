<?php

namespace App\Http\Controllers\Api;

use App\Models\ResearchProject;
use App\Models\Task;
use App\Models\Notification;
use App\Models\ProjectInvitation;
use App\Models\ExportJob;
use App\Models\CorpusCorrectionProposal;
use App\Models\EvidenceItem;
use App\Models\ProjectQuestion;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class HomeController extends ApiController
{
    /**
     * Aggregated home dashboard for active researcher (API-3 / screen 02).
     */
    public function dashboard(Request $request): JsonResponse
    {
        $user = $request->user();
        $userId = $user->id;

        // Recent projects
        $recentProjects = ResearchProject::where(function ($q) use ($userId) {
            $q->where('owner_id', $userId)
              ->orWhereHas('memberships', fn($mq) => $mq->where('user_id', $userId)->where('status', 'accepted'));
        })->where('is_deleted', false)
          ->where('is_archived', false)
          ->withCount(['evidenceItems', 'resources', 'findings'])
          ->latest('updated_at')
          ->limit(5)
          ->get();

        $projectIds = $recentProjects->pluck('id')->all();

        // Next actions computation
        $nextActions = [];

        // Check for candidate evidence items (C-5: real column is 'state')
        $candidateCount = EvidenceItem::whereIn('project_id', $projectIds)->where('state', 'candidate')->count();
        if ($candidateCount > 0) {
            $nextActions[] = [
                'kind' => 'evidence_review',
                'label' => "Review {$candidateCount} candidate evidence items",
                'project_id' => $projectIds[0] ?? null,
                'target_type' => 'evidence',
                'cta' => 'Review items',
            ];
        }

        // Check for open questions
        $openQuestion = ProjectQuestion::whereIn('project_id', $projectIds)->where('resolved', false)->first();
        if ($openQuestion) {
            $nextActions[] = [
                'kind' => 'open_question',
                'label' => "Answer an open question: '{$openQuestion->text}'",
                'project_id' => $openQuestion->project_id,
                'target_type' => 'question',
                'target_id' => $openQuestion->id,
                'cta' => 'View question',
            ];
        }

        // Counts
        $openTasksCount = Task::where('assignee_id', $userId)->where('status', 'open')->count();
        $unreadNotificationsCount = Notification::where('user_id', $userId)->where('is_read', false)->count();
        $pendingInvitationsCount = ProjectInvitation::where('email', $user->email)->where('status', 'pending')->count();

        // Recent exports
        $exports = ExportJob::where('requester_id', $userId)
            ->latest('created_at')
            ->limit(3)
            ->get();

        // Dynamically computed updates (C-9: no hardcoded fake entries)
        $updates = [];
        $announcements = \App\Models\Announcement::where('status', 'published')
            ->latest('published_at')
            ->limit(3)
            ->get();
        foreach ($announcements as $ann) {
            $updates[] = [
                'id' => $ann->id,
                'type' => 'announcement',
                'title' => $ann->title,
                'summary' => $ann->summary,
                'created_at' => $ann->published_at?->toIso8601String() ?? $ann->created_at?->toIso8601String(),
            ];
        }

        $decidedProposals = CorpusCorrectionProposal::where('researcher_id', $userId)
            ->whereIn('status', ['approved', 'rejected'])
            ->latest('decided_at')
            ->limit(3)
            ->get();
        foreach ($decidedProposals as $p) {
            $updates[] = [
                'id' => $p->id,
                'type' => 'corpus_proposal_' . $p->status,
                'title' => "Corpus Proposal #{$p->id} {$p->status}",
                'summary' => "Your correction proposal on {$p->corpus_table} (ID: {$p->corpus_id}) was {$p->status}.",
                'created_at' => $p->decided_at?->toIso8601String() ?? $p->created_at?->toIso8601String(),
            ];
        }

        return $this->successResponse([
            'recent_projects' => $recentProjects,
            'next_actions' => $nextActions,
            'exports' => $exports,
            'updates' => $updates,
            'counts' => [
                'tasks' => $openTasksCount,
                'unread_notifications' => $unreadNotificationsCount,
                'invitations' => $pendingInvitationsCount,
            ],
        ]);
    }

    /**
     * Cross-project tasks assigned to current user.
     */
    public function myTasks(Request $request): JsonResponse
    {
        $userId = $request->user()->id;
        $query = Task::where('assignee_id', $userId)->with('project:id,title');

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        $perPage = min((int)$request->input('per_page', 20), 100);
        $tasks = $query->orderBy('due_date', 'asc')->paginate($perPage);

        return $this->paginatedResponse($tasks);
    }

    /**
     * Cross-project exports requested by current user.
     */
    public function myExports(Request $request): JsonResponse
    {
        $userId = $request->user()->id;
        $query = ExportJob::where('requester_id', $userId);

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        $perPage = min((int)$request->input('per_page', 20), 100);
        $exports = $query->latest('created_at')->paginate($perPage);

        return $this->paginatedResponse($exports);
    }

    /**
     * Corpus proposals submitted by current user.
     */
    public function myCorpusProposals(Request $request): JsonResponse
    {
        $userId = $request->user()->id;
        $query = CorpusCorrectionProposal::where('researcher_id', $userId);

        $perPage = min((int)$request->input('per_page', 20), 100);
        $proposals = $query->latest('created_at')->paginate($perPage);

        return $this->paginatedResponse($proposals);
    }
}
