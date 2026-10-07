<?php

namespace App\Http\Controllers\Api;

use App\Models\User;
use App\Models\ResearcherApplication;
use App\Models\AuditEvent;
use App\Models\CorpusCorrectionProposal;
use App\Models\ResearchProject;
use App\Models\Document;
use App\Models\SupportGrant;
use App\Models\SystemLimit;
use App\Models\ExportJob;
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
     * List platform users with roles, MFA, and codes (Module 12 / API-10).
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
        $paginator = $query->latest('created_at')->paginate($perPage);

        $enriched = $paginator->getCollection()->map(function ($u) {
            return [
                'id' => $u->id,
                'code' => 'USR-' . str_pad($u->id, 4, '0', STR_PAD_LEFT),
                'display_name' => $u->display_name,
                'email' => $u->email,
                'roles' => $u->roles,
                'status' => $u->status,
                'is_admin' => (bool)$u->is_admin,
                'mfa' => $u->mfa_enabled ? 'totp' : 'none',
                'created_at' => $u->created_at?->toIso8601String(),
                'last_login_at' => $u->tokens()->latest('last_used_at')->value('last_used_at'),
            ];
        });

        return response()->json([
            'success' => true,
            'message' => 'Success',
            'data' => $enriched,
            'meta' => [
                'timestamp' => now()->toIso8601String(),
                'version' => 'v1',
                'pagination' => [
                    'current_page' => $paginator->currentPage(),
                    'per_page' => $paginator->perPage(),
                    'total_items' => $paginator->total(),
                    'total_pages' => $paginator->lastPage(),
                    'has_more' => $paginator->hasMorePages(),
                ],
            ],
        ], 200);
    }

    /**
     * Update user roles with self-modification prevention (API-10).
     */
    public function updateUserRoles(Request $request, int $id): JsonResponse
    {
        if ($res = $this->checkAdmin($request)) return $res;

        $user = User::findOrFail($id);

        // An admin cannot change their own role!
        if ($request->user()->id === $user->id) {
            AuditService::log(
                actorId: $request->user()->id,
                action: 'update_own_role_refused',
                objectType: 'user',
                objectId: $user->id,
                details: ['reason' => 'Admin cannot modify their own roles.'],
                ipAddress: $request->ip()
            );

            return $this->errorResponse('Administrators cannot modify their own roles.', 'FORBIDDEN', 403);
        }

        $validated = $request->validate([
            'roles' => 'required|array',
            'roles.*' => 'string|in:admin,editor,corpus_editor,researcher,reviewer',
        ]);

        $profile = $user->profile()->firstOrCreate(['user_id' => $user->id]);
        $profile->update(['roles' => $validated['roles']]);

        // If 'admin' in roles, ensure is_admin flag is synced
        $user->update(['is_admin' => in_array('admin', $validated['roles'])]);

        AuditService::log(
            actorId: $request->user()->id,
            action: 'update_user_roles',
            objectType: 'user',
            objectId: $user->id,
            details: ['roles' => $validated['roles']],
            ipAddress: $request->ip()
        );

        return $this->successResponse($user->fresh('profile'), 'User roles updated successfully.');
    }

    /**
     * Suspend, approve, or update user account status.
     */
    public function updateUserStatus(Request $request, int $id): JsonResponse
    {
        if ($res = $this->checkAdmin($request)) return $res;

        $user = User::findOrFail($id);

        $validated = $request->validate([
            'status' => 'required|string|in:approved,suspended,pending,unverified,rejected',
            'reason' => 'required|string|min:3', // Made required per API-10
        ]);

        if ($user->id === $request->user()->id && in_array($validated['status'], ['suspended', 'rejected'])) {
            return $this->errorResponse('Administrators cannot suspend or reject their own account.', 'FORBIDDEN', 403);
        }

        $oldStatus = $user->status;
        $user->update(['status' => $validated['status']]);

        // Revoke active sessions/tokens upon suspension (C-20)
        if ($validated['status'] === 'suspended') {
            $user->tokens()->delete();
        }

        AuditService::log(
            actorId: $request->user()->id,
            action: 'update_user_status',
            objectType: 'user',
            objectId: $user->id,
            details: [
                'old_status' => $oldStatus,
                'new_status' => $validated['status'],
                'reason' => $validated['reason'],
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

        $query = ResearcherApplication::with(['user.profile', 'replies'])
            ->whereHas('user', function ($q) {
                $q->where('status', '!=', 'unverified');
            });

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        $perPage = min((int) ($request->input('per_page', 20)), 100);
        $applications = $query->latest('created_at')->paginate($perPage);

        return $this->paginatedResponse($applications);
    }

    /**
     * Decide on researcher application: approved | rejected | information_requested (API-1).
     */
    public function decideApplication(Request $request, int $id): JsonResponse
    {
        if ($res = $this->checkAdmin($request)) return $res;

        $application = ResearcherApplication::findOrFail($id);

        // A decided application cannot be decided again (C-20)
        if (!in_array($application->status, ['pending', 'information_requested'])) {
            return $this->errorResponse('Application has already been decided.', 'CONFLICT', 409);
        }

        $validated = $request->validate([
            'decision' => 'required|string|in:approved,rejected,information_requested',
            'decision_reason' => 'sometimes|nullable|string|min:5',
            'message' => 'required_if:decision,information_requested|nullable|string',
        ]);

        $decision = $validated['decision'];
        $reason = $validated['decision_reason'] ?? $validated['message'] ?? 'Administrative decision';

        if ($decision === 'approved') {
            $application->update([
                'status' => 'approved',
                'decision_reason' => $reason,
                'decided_by' => $request->user()->id,
                'decided_at' => now(),
            ]);
            $application->user->update(['status' => 'approved']);
        } elseif ($decision === 'rejected') {
            $application->update([
                'status' => 'rejected',
                'decision_reason' => $reason,
                'decided_by' => $request->user()->id,
                'decided_at' => now(),
            ]);
            // Rejecting the application also marks user status as rejected (DEF-6)
            $application->user->update(['status' => 'rejected']);
        } else {
            // Information requested
            $application->update([
                'status' => 'information_requested',
                'information_request' => [
                    'message' => $validated['message'],
                    'requested_at' => now()->toIso8601String(),
                    'deadline' => now()->addDays(7)->toIso8601String(),
                ],
            ]);
        }

        AuditService::log(
            actorId: $request->user()->id,
            action: 'decide_application',
            objectType: 'researcher_application',
            objectId: $application->id,
            details: [
                'target_user_id' => $application->user_id,
                'decision' => $decision,
                'reason' => $reason,
            ],
            ipAddress: $request->ip()
        );

        return $this->successResponse(
            $application->fresh(['user', 'replies']),
            "Application decision recorded: {$decision}."
        );
    }

    /**
     * List account closure requests (API-10).
     */
    public function listClosures(Request $request): JsonResponse
    {
        if ($res = $this->checkAdmin($request)) return $res;

        $perPage = min((int)$request->input('per_page', 20), 100);
        $closures = User::where('status', 'closure_requested')
            ->select(['id', 'display_name', 'email', 'closure_requested_at', 'closure_reason'])
            ->paginate($perPage)
            ->through(fn (User $user) => $user->makeVisible(['closure_requested_at', 'closure_reason']));

        return $this->paginatedResponse($closures);
    }

    /**
     * Decide on account closure request (API-10).
     */
    public function decideClosure(Request $request, int $id): JsonResponse
    {
        if ($res = $this->checkAdmin($request)) return $res;

        $user = User::where('status', 'closure_requested')->findOrFail($id);

        $validated = $request->validate([
            'decision' => 'required|string|in:approved,rejected',
            'reason' => 'nullable|string',
        ]);

        if ($validated['decision'] === 'approved') {
            $user->update(['status' => 'suspended']); // Closed/suspended
            $user->tokens()->delete();
        } else {
            $user->update(['status' => 'approved', 'closure_requested_at' => null, 'closure_reason' => null]);
        }

        return $this->successResponse($user, "Closure request {$validated['decision']}.");
    }

    /**
     * Limits and quotas (API-10).
     */
    public function getLimits(Request $request): JsonResponse
    {
        if ($res = $this->checkAdmin($request)) return $res;

        $limits = SystemLimit::all()->pluck('limit_value', 'key')->all();

        $defaults = [
            'applications_per_email_per_day' => 1,
            'resend_verification_per_minute' => 1,
            'resend_verification_per_day' => 5,
            'invitations_per_project_per_day' => 20,
            'download_storage_limit_gb' => 5,
            'package_part_size_gb' => 1,
            'concurrent_export_jobs' => 2,
            'result_set_max_size' => 5000,
        ];

        return $this->successResponse(array_merge($defaults, $limits));
    }

    public function updateLimits(Request $request): JsonResponse
    {
        if ($res = $this->checkAdmin($request)) return $res;

        $validated = $request->validate([
            'limits' => 'required|array',
        ]);

        foreach ($validated['limits'] as $key => $value) {
            SystemLimit::updateOrCreate(
                ['key' => $key],
                ['limit_value' => $value]
            );
        }

        return $this->successResponse(null, 'System limits and quotas updated.');
    }

    /**
     * List active support grants (API-10).
     */
    public function listSupportGrants(Request $request): JsonResponse
    {
        if ($res = $this->checkAdmin($request)) return $res;

        $grants = SupportGrant::with(['grantor:id,display_name', 'admin:id,display_name'])
            ->orderBy('created_at', 'desc')
            ->get();

        return $this->successResponse($grants);
    }

    /**
     * List support grants issued by current researcher (API-10 / C-21).
     */
    public function listResearcherSupportGrants(Request $request): JsonResponse
    {
        $grants = SupportGrant::where('granted_by', $request->user()->id)
            ->with(['admin:id,display_name'])
            ->orderBy('created_at', 'desc')
            ->get();

        return $this->successResponse($grants);
    }

    /**
     * Grant support access (called by researcher) (API-10 / C-20).
     */
    public function createSupportGrant(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'admin_id' => 'required|integer|exists:users,id',
            'scope' => 'required|string|in:project,document',
            'object_id' => 'required|integer',
            'expires_at' => 'nullable|date',
            'expires_days' => 'nullable|integer|min:1',
            'reason' => 'required|string|min:5',
        ]);

        $expiresAt = $validated['expires_at'] ?? now()->addDays($validated['expires_days'] ?? 7);

        $admin = User::find($validated['admin_id']);
        if (!$admin || !$admin->is_admin) {
            return $this->errorResponse('The designated grantee must be an administrator.', 'VALIDATION_ERROR', 422, [
                'admin_id' => ['The specified user is not an administrator.'],
            ]);
        }

        if ($validated['scope'] === 'project') {
            $project = ResearchProject::where('is_deleted', false)->find($validated['object_id']);
            if (!$project || !$this->policyService->canAccessProject($request->user(), 'view', $project)) {
                return $this->errorResponse('Project not found or not accessible by you.', 'NOT_FOUND', 404);
            }
        } elseif ($validated['scope'] === 'document') {
            $doc = Document::find($validated['object_id']);
            if (!$doc || !$doc->project || !$this->policyService->canAccessProject($request->user(), 'view', $doc->project)) {
                return $this->errorResponse('Document not found or not accessible by you.', 'NOT_FOUND', 404);
            }
        }

        $grant = SupportGrant::create([
            'granted_by' => $request->user()->id,
            'admin_id' => $validated['admin_id'],
            'scope' => $validated['scope'],
            'object_id' => $validated['object_id'],
            'expires_at' => $expiresAt,
            'reason' => $validated['reason'],
            'status' => 'active',
            'created_at' => now(),
        ]);

        return $this->successResponse($grant, 'Support access granted.', 201);
    }

    /**
     * Revoke support grant (API-10).
     */
    public function destroySupportGrant(Request $request, int $id): JsonResponse
    {
        $grant = SupportGrant::where('granted_by', $request->user()->id)
            ->orWhere(fn($q) => $q->where('admin_id', $request->user()->id))
            ->findOrFail($id);

        $grant->delete();

        return $this->successResponse(null, 'Support access grant revoked.');
    }

    /**
     * System Jobs and Operations (API-10).
     */
    public function listJobs(Request $request): JsonResponse
    {
        if ($res = $this->checkAdmin($request)) return $res;

        $query = ExportJob::query();
        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        $perPage = min((int)$request->input('per_page', 20), 100);
        $jobs = $query->latest('created_at')->paginate($perPage);

        return $this->paginatedResponse($jobs);
    }

    public function retryJob(Request $request, int $id): JsonResponse
    {
        if ($res = $this->checkAdmin($request)) return $res;

        $job = ExportJob::findOrFail($id);
        $job->update([
            'status' => 'queued',
            'failure_reason' => null,
            'progress' => '0%',
        ]);

        return $this->successResponse($job, 'Job queued for retry.');
    }

    public function systemOps(Request $request): JsonResponse
    {
        if ($res = $this->checkAdmin($request)) return $res;

        $queueDepth = ExportJob::whereIn('status', ['queued', 'running'])->count();
        $failuresCount = ExportJob::where('status', 'failed')->count();

        // Calculate storage used by export files
        $exportStorageDir = storage_path('app/exports');
        $storageUsed = 0;
        if (is_dir($exportStorageDir)) {
            foreach (new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($exportStorageDir, \FilesystemIterator::SKIP_DOTS)) as $file) {
                $storageUsed += $file->getSize();
            }
        }

        // Active alerts computed from actual platform states
        $alerts = [];
        if ($failuresCount > 0) {
            $alerts[] = [
                'severity' => 'warning',
                'message' => "{$failuresCount} export job failure(s) require administrative review.",
            ];
        }

        $pendingProposals = CorpusCorrectionProposal::whereIn('status', ['submitted', 'pending'])->count();
        if ($pendingProposals > 0) {
            $alerts[] = [
                'severity' => 'info',
                'message' => "{$pendingProposals} corpus correction proposal(s) awaiting review.",
            ];
        }

        return $this->successResponse([
            'queue_depth' => $queueDepth,
            'failures_count' => $failuresCount,
            'storage_used_bytes' => $storageUsed,
            'active_alerts' => $alerts,
        ]);
    }

    /**
     * Query global audit events log with stable code and outcome (API-10).
     */
    public function auditLogs(Request $request): JsonResponse
    {
        if ($res = $this->checkAdmin($request)) return $res;

        $query = AuditEvent::with('actor:id,display_name');

        if ($request->filled('q')) {
            $term = $request->input('q');
            $query->where(function ($q) use ($term) {
                $q->where('action', 'ILIKE', "%{$term}%")
                  ->orWhere('object_type', 'ILIKE', "%{$term}%");
            });
        }

        if ($request->filled('action')) {
            $query->where('action', $request->input('action'));
        }

        if ($request->filled('object_type')) {
            $query->where('object_type', $request->input('object_type'));
        }

        if ($request->filled('actor_id')) {
            $query->where('actor_id', $request->input('actor_id'));
        }

        if ($request->filled('from')) {
            $query->where('created_at', '>=', $request->input('from'));
        }

        if ($request->filled('to')) {
            $query->where('created_at', '<=', $request->input('to'));
        }

        $perPage = min((int) ($request->input('per_page', 50)), 100);
        $paginator = $query->latest('created_at')->paginate($perPage);

        $enriched = $paginator->getCollection()->map(function ($log) {
            $isRefused = str_contains($log->action, 'refused');
            return [
                'id' => $log->id,
                'code' => 'AUD-' . str_pad($log->id, 5, '0', STR_PAD_LEFT),
                'actor_id' => $log->actor_id,
                'actor' => $log->actor ? [
                    'id' => $log->actor->id,
                    'display_name' => $log->actor->display_name,
                ] : null,
                'action' => $log->action,
                'object_type' => $log->object_type,
                'object_id' => $log->object_id,
                'outcome' => $isRefused ? 'refused' : ($log->details['outcome'] ?? 'success'),
                'details' => $log->details,
                'created_at' => $log->created_at?->toIso8601String(),
            ];
        });

        return response()->json([
            'success' => true,
            'message' => 'Success',
            'data' => $enriched,
            'meta' => [
                'timestamp' => now()->toIso8601String(),
                'version' => 'v1',
                'pagination' => [
                    'current_page' => $paginator->currentPage(),
                    'per_page' => $paginator->perPage(),
                    'total_items' => $paginator->total(),
                    'total_pages' => $paginator->lastPage(),
                    'has_more' => $paginator->hasMorePages(),
                ],
            ],
        ], 200);
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
     * Rights flags and restricted editions (API-10).
     */
    public function listRightsFlags(Request $request): JsonResponse
    {
        if ($res = $this->checkAdmin($request)) return $res;

        return $this->successResponse([
            ['edition_id' => 1, 'title' => 'Dar al-Kutub al-Ilmiyyah Edition', 'restriction' => 'academic_fair_use_only'],
        ]);
    }

    /**
     * Public reports and abuse submissions (API-10).
     */
    public function listReports(Request $request): JsonResponse
    {
        if ($res = $this->checkAdmin($request)) return $res;

        return $this->successResponse([]);
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
            'evidence_id' => 'nullable|integer|exists:evidence_items,id',
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
        $proposals = $query->latest('created_at')->paginate($perPage)
            ->through(fn (CorpusCorrectionProposal $p) => $this->formatProposal($p));

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

        if (!in_array($proposal->status, ['submitted', 'pending'], true)) {
            return $this->errorResponse('This correction has already been decided.', 'ALREADY_DECIDED', 409);
        }

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

        return $this->successResponse($this->formatProposal($proposal->fresh(['researcher', 'decider'])), "Proposal {$validated['status']}.");
    }

    /**
     * A correction with only the names of who proposed and decided it, not their whole accounts.
     *
     * @return array<string, mixed>
     */
    private function formatProposal(CorpusCorrectionProposal $proposal): array
    {
        return [
            'id' => $proposal->id,
            'researcher_id' => $proposal->researcher_id,
            'corpus_table' => $proposal->corpus_table,
            'corpus_id' => $proposal->corpus_id,
            'current_value' => $proposal->current_value,
            'proposed_value' => $proposal->proposed_value,
            'evidence_notes' => $proposal->evidence_notes,
            'status' => $proposal->status,
            'decided_by' => $proposal->decided_by,
            'decided_at' => $proposal->decided_at?->toIso8601String(),
            'created_at' => $proposal->created_at?->toIso8601String(),
            'researcher' => $proposal->researcher ? ['id' => $proposal->researcher->id, 'display_name' => $proposal->researcher->display_name] : null,
            'decider' => $proposal->decider ? ['id' => $proposal->decider->id, 'display_name' => $proposal->decider->display_name] : null,
        ];
    }
}
