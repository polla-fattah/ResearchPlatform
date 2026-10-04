<?php

namespace App\Http\Controllers\Api;

use App\Models\User;
use App\Models\ResearcherApplication;
use App\Models\AuditEvent;
use App\Models\CorpusCorrectionProposal;
use App\Models\ResearchProject;
use App\Services\AuditService;
use App\Services\AuthPolicyService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class AdminController extends ApiController
{
    public function __construct(
        protected AuthPolicyService $policyService
    ) {}

    /**
     * Enforce admin privilege check.
     */
    private function checkAdmin(Request $request): ?JsonResponse
    {
        if (!$request->user() || !$request->user()->is_admin) {
            return $this->errorResponse('Administrative privileges required.', 'FORBIDDEN', 403);
        }
        return null;
    }

    /**
     * List platform users (Module 12).
     */
    public function users(Request $request): JsonResponse
    {
        if ($res = $this->checkAdmin($request)) return $res;

        $query = User::with('profile');

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('q')) {
            $term = $request->input('q');
            $query->where(function ($q) use ($term) {
                $q->where('display_name', 'ILIKE', "%{$term}%")
                  ->orWhere('email', 'ILIKE', "%{$term}%");
            });
        }

        $perPage = min((int) ($request->input('per_page', 20)), 100);
        $users = $query->latest('created_at')->paginate($perPage);

        return $this->paginatedResponse($users);
    }

    /**
     * Suspend, approve, or update user account status.
     */
    public function updateUserStatus(Request $request, int $id): JsonResponse
    {
        if ($res = $this->checkAdmin($request)) return $res;

        $user = User::findOrFail($id);

        $validated = $request->validate([
            'status' => 'required|string|in:approved,suspended,pending,unverified',
            'reason' => 'nullable|string',
        ]);

        $oldStatus = $user->status;
        $user->update(['status' => $validated['status']]);

        AuditService::log(
            actorId: $request->user()->id,
            action: 'update_user_status',
            objectType: 'user',
            objectId: $user->id,
            details: [
                'old_status' => $oldStatus,
                'new_status' => $validated['status'],
                'reason' => $validated['reason'] ?? null,
            ],
            ipAddress: $request->ip()
        );

        return $this->successResponse($user, "User status updated to {$validated['status']}.");
    }

    /**
     * List researcher verification applications.
     */
    public function applications(Request $request): JsonResponse
    {
        if ($res = $this->checkAdmin($request)) return $res;

        $query = ResearcherApplication::with(['user.profile']);

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        $perPage = min((int) ($request->input('per_page', 20)), 100);
        $applications = $query->latest('created_at')->paginate($perPage);

        return $this->paginatedResponse($applications);
    }

    /**
     * Decide on researcher application (approve/reject).
     */
    public function decideApplication(Request $request, int $id): JsonResponse
    {
        if ($res = $this->checkAdmin($request)) return $res;

        $application = ResearcherApplication::findOrFail($id);

        $validated = $request->validate([
            'decision' => 'required|string|in:approved,rejected',
            'decision_reason' => 'required|string|min:5',
        ]);

        $application->update([
            'status' => $validated['decision'],
            'decision_reason' => $validated['decision_reason'],
            'decided_by' => $request->user()->id,
            'decided_at' => now(),
        ]);

        if ($validated['decision'] === 'approved') {
            $application->user->update(['status' => 'approved']);
        }

        AuditService::log(
            actorId: $request->user()->id,
            action: 'decide_application',
            objectType: 'researcher_application',
            objectId: $application->id,
            details: [
                'target_user_id' => $application->user_id,
                'decision' => $validated['decision'],
                'reason' => $validated['decision_reason'],
            ],
            ipAddress: $request->ip()
        );

        return $this->successResponse(
            $application->fresh('user'),
            "Application has been {$validated['decision']}."
        );
    }

    /**
     * Query global audit events log (Module 11).
     */
    public function auditLogs(Request $request): JsonResponse
    {
        if ($res = $this->checkAdmin($request)) return $res;

        $query = AuditEvent::with('actor');

        if ($request->filled('action')) {
            $query->where('action', $request->input('action'));
        }

        if ($request->filled('object_type')) {
            $query->where('object_type', $request->input('object_type'));
        }

        $perPage = min((int) ($request->input('per_page', 50)), 100);
        $logs = $query->latest('created_at')->paginate($perPage);

        return $this->paginatedResponse($logs);
    }

    /**
     * Query project activity trail (Module 11).
     */
    public function projectActivity(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $perPage = min((int) ($request->input('per_page', 50)), 100);

        $logs = AuditEvent::where(function ($q) use ($projectId) {
            $q->where(fn($sub) => $sub->where('object_type', 'project')->where('object_id', $projectId))
              ->orWhereRaw("details->>'project_id' = ?", [(string) $projectId]);
        })->with('actor')->latest('created_at')->paginate($perPage);

        return $this->paginatedResponse($logs);
    }

    /**
     * Submit an erratum or correction proposal for canonical Hadith corpus (EVI-07).
     */
    public function submitCorpusProposal(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'corpus_table' => 'required|string|in:hadiths,narrators,books,sanads',
            'corpus_id' => 'required|integer',
            'current_value' => 'required|string',
            'proposed_value' => 'required|string',
            'evidence_notes' => 'required|string|min:10',
        ]);

        $proposal = CorpusCorrectionProposal::create([
            'researcher_id' => $request->user()->id,
            'corpus_table' => $validated['corpus_table'],
            'corpus_id' => $validated['corpus_id'],
            'current_value' => $validated['current_value'],
            'proposed_value' => $validated['proposed_value'],
            'evidence_notes' => $validated['evidence_notes'],
            'status' => 'submitted',
            'created_at' => now(),
        ]);

        return $this->successResponse($proposal, 'Corpus correction proposal submitted.', 201);
    }

    /**
     * List corpus correction proposals queue for editorial review.
     */
    public function listCorpusProposals(Request $request): JsonResponse
    {
        if ($res = $this->checkAdmin($request)) return $res;

        $query = CorpusCorrectionProposal::with(['researcher', 'decider']);

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        $perPage = min((int) ($request->input('per_page', 20)), 100);
        $proposals = $query->latest('created_at')->paginate($perPage);

        return $this->paginatedResponse($proposals);
    }

    /**
     * Accept or reject corpus correction proposal.
     */
    public function decideCorpusProposal(Request $request, int $id): JsonResponse
    {
        if ($res = $this->checkAdmin($request)) return $res;

        $proposal = CorpusCorrectionProposal::findOrFail($id);

        $validated = $request->validate([
            'status' => 'required|string|in:accepted,rejected',
        ]);

        $proposal->update([
            'status' => $validated['status'],
            'decided_by' => $request->user()->id,
            'decided_at' => now(),
        ]);

        AuditService::log(
            actorId: $request->user()->id,
            action: 'decide_corpus_proposal',
            objectType: 'corpus_correction_proposal',
            objectId: $proposal->id,
            details: [
                'corpus_table' => $proposal->corpus_table,
                'corpus_id' => $proposal->corpus_id,
                'status' => $validated['status'],
            ],
            ipAddress: $request->ip()
        );

        return $this->successResponse($proposal->fresh(['researcher', 'decider']), "Proposal {$validated['status']}.");
    }
}
