<?php

namespace App\Http\Controllers\Api;

use App\Models\Submission;
use App\Models\ReviewAssignment;
use App\Models\EditorialDecision;
use App\Models\Publication;
use App\Models\ProjectMembership;
use App\Models\User;
use App\Services\AuthPolicyService;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;

class EditorialController extends ApiController
{
    public function __construct(
        protected AuthPolicyService $policyService,
        protected AuditService $auditService
    ) {}

    /**
     * Enforce editor/administrative privilege check (DEF-7).
     */
    private function checkEditor(Request $request): ?JsonResponse
    {
        $user = $request->user();
        $isEditor = $user && ($user->is_admin || in_array('editor', $user->roles ?? []));
        if (!$isEditor) {
            return $this->errorResponse('Editorial privileges required.', 'FORBIDDEN', 403);
        }
        return null;
    }

    /**
     * Editorial review queue (ADM-02, PUB-03, PUB-04).
     * Supports filtering by stage, reviewer, age in days, and required action.
     */
    public function submissions(Request $request): JsonResponse
    {
        if ($res = $this->checkEditor($request)) return $res;

        $query = Submission::with(['project.owner', 'submitter', 'reviews.reviewer', 'decision.editor', 'publication']);

        // Stage-based queue filter (ADM-02)
        if ($request->filled('stage')) {
            match ($request->input('stage')) {
                'triage' => $query->where('status', 'submitted'),
                'under_review' => $query->where('status', 'in_review'),
                'revisions_pending' => $query->where('status', 'revision_requested'),
                'ready_for_decision' => $query->where('status', 'in_review')->whereHas('reviews', fn($rq) => $rq->whereNotNull('completed_at')),
                'approved_pending_release' => $query->where('status', 'approved')->whereDoesntHave('publication'),
                default => null,
            };
        }

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('reviewer_id')) {
            $rId = (int) $request->input('reviewer_id');
            $query->whereHas('reviews', fn($rq) => $rq->where('reviewer_id', $rId));
        }

        // Submissions older than X days (age triage)
        if ($request->filled('min_age_days')) {
            $days = (int) $request->input('min_age_days');
            $query->where('submitted_at', '<=', now()->subDays($days));
        }

        // Action required filter
        if ($request->filled('action_required')) {
            match ($request->input('action_required')) {
                'assign_reviewer' => $query->where(fn($q) => $q->where('status', 'submitted')->orWhereDoesntHave('reviews')),
                'submit_review' => $query->whereHas('reviews', fn($rq) => $rq->whereNull('completed_at')),
                'editor_decision' => $query->where('status', 'in_review')->whereHas('reviews', fn($rq) => $rq->whereNotNull('completed_at')),
                'release' => $query->where('status', 'approved')->whereDoesntHave('publication'),
                default => null,
            };
        }

        if ($request->filled('q')) {
            $term = $request->input('q');
            $query->where(function ($q) use ($term) {
                $q->where('title', 'ILIKE', "%{$term}%")
                  ->orWhere('abstract', 'ILIKE', "%{$term}%");
            });
        }

        $perPage = min((int) ($request->input('per_page', 20)), 100);
        $submissions = $query->latest('submitted_at')->paginate($perPage);

        // Omit heavy frozen_package from list rows, providing summary instead (C-30)
        $submissions->getCollection()->transform(function ($sub) {
            $data = $sub->toArray();
            unset($data['frozen_package']);
            $data['package_summary'] = [
                'document_count' => count($sub->frozen_package['documents'] ?? []),
                'finding_count' => count($sub->frozen_package['findings'] ?? []),
                'evidence_count' => count($sub->frozen_package['evidence_items'] ?? []),
                'package_checksum' => $sub->package_checksum,
            ];
            return $data;
        });

        return $this->paginatedResponse($submissions);
    }

    /**
     * Assign peer reviewer to submission (PUB-04, PUB-05).
     * Enforces strict Conflict-of-Interest prevention.
     */
    public function assignReviewer(Request $request, int $id): JsonResponse
    {
        if ($res = $this->checkEditor($request)) return $res;

        $submission = Submission::with('project')->findOrFail($id);

        $validated = $request->validate([
            'reviewer_id' => 'required|integer|exists:users,id',
            'due_date' => 'nullable|date|after:today',
            'coi_confirmed' => 'nullable|boolean',
        ]);

        $reviewer = User::findOrFail($validated['reviewer_id']);

        // Reviewer must be approved
        if ($reviewer->status !== 'approved') {
            return $this->errorResponse('Reviewer must have an approved researcher account.', 'INVALID_REVIEWER', 422);
        }

        // Conflict of Interest Prevention (PUB-05): Reviewer cannot be submitter, owner, or team member
        $isMember = ProjectMembership::where('project_id', $submission->project_id)
            ->where('user_id', $reviewer->id)
            ->where('status', 'accepted')
            ->exists();

        if ($reviewer->id === $submission->submitted_by || $reviewer->id === $submission->project->owner_id || $isMember) {
            return $this->errorResponse('Conflict of interest: The author or project team members cannot review their own submission.', 'CONFLICT_OF_INTEREST', 422);
        }

        // Check if already assigned
        $existing = ReviewAssignment::where('submission_id', $submission->id)
            ->where('reviewer_id', $reviewer->id)
            ->first();

        if ($existing) {
            return $this->errorResponse('This reviewer is already assigned to this submission.', 'ALREADY_ASSIGNED', 422);
        }

        $assignment = ReviewAssignment::create([
            'submission_id' => $submission->id,
            'reviewer_id' => $reviewer->id,
            'due_date' => $validated['due_date'] ?? now()->addDays(14),
            'coi_confirmed' => $validated['coi_confirmed'] ?? true,
            'created_at' => now(),
        ]);

        // Transition submission status to in_review if it was submitted
        if ($submission->status === 'submitted') {
            $submission->update(['status' => 'in_review']);
        }

        $this->auditService->record(
            $request->user()->id,
            'assign_reviewer',
            'submission',
            $submission->id,
            ['reviewer_id' => $reviewer->id, 'submission_title' => $submission->title],
            $request->ip()
        );

        return $this->successResponse(
            $assignment->load('reviewer'),
            'Peer reviewer assigned successfully.',
            201
        );
    }

    /**
     * Peer reviewer submits their recommendation, evaluation score & notes (PUB-04, PUB-05, C-31).
     */
    public function submitReview(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        // Check if $id is an assignment ID or submission ID
        $assignment = ReviewAssignment::where('id', $id)->where('reviewer_id', $user->id)->first();
        if (!$assignment) {
            $assignment = ReviewAssignment::where('submission_id', $id)->where('reviewer_id', $user->id)->first();
        }

        if (!$assignment) {
            return $this->errorResponse('You are not assigned as a reviewer for this submission.', 'FORBIDDEN', 403);
        }

        // A completed review cannot be submitted again (C-31)
        if ($assignment->completed_at || $assignment->status === 'completed') {
            return $this->errorResponse('This peer review assignment has already been completed and submitted.', 'CONFLICT', 409);
        }

        $validated = $request->validate([
            'recommendation' => 'required|string|in:approve,request_revisions,reject',
            'score' => 'nullable|integer|min:1|max:10',
            'reviewer_notes' => 'required|string|min:10',
            'coi_confirmed' => 'nullable|boolean',
        ]);

        $assignment->update([
            'status' => 'completed',
            'recommendation' => $validated['recommendation'],
            'score' => $validated['score'] ?? null,
            'reviewer_notes' => $validated['reviewer_notes'],
            'coi_confirmed' => $validated['coi_confirmed'] ?? true,
            'completed_at' => now(),
        ]);

        $this->auditService->record(
            $user->id,
            'submit_review',
            'review_assignment',
            $assignment->id,
            ['recommendation' => $validated['recommendation'], 'score' => $validated['score'] ?? null],
            $request->ip()
        );

        return $this->successResponse($assignment, 'Peer review evaluation submitted.');
    }

    /**
     * Editorial decision (PUB-03, PUB-04, PUB-05).
     * Enforces COI check on deciding editor and requires completed peer review for approval.
     */
    public function decide(Request $request, int $id): JsonResponse
    {
        if ($res = $this->checkEditor($request)) return $res;

        $submission = Submission::with('project')->findOrFail($id);
        $user = $request->user();

        // Conflict of Interest Prevention (PUB-05): Deciding editor cannot be author or project member
        $isProjectMember = ProjectMembership::where('project_id', $submission->project_id)
            ->where('user_id', $user->id)
            ->where('status', 'accepted')
            ->exists();

        if ($user->id === $submission->submitted_by || $user->id === $submission->project->owner_id || $isProjectMember) {
            return $this->errorResponse('Conflict of interest: Authors or project team members cannot make editorial decisions on their own submissions.', 'CONFLICT_OF_INTEREST', 403);
        }

        // Submissions can only be decided while in submitted or in_review state (C-30)
        if (!in_array($submission->status, ['submitted', 'in_review'])) {
            return $this->errorResponse("Cannot decide on submission with status [{$submission->status}]. Only 'submitted' or 'in_review' submissions can be decided.", 'CONFLICT', 409);
        }

        $validated = $request->validate([
            'decision' => 'required|string|in:approve,request_revisions,reject',
            'decision_notes' => 'required|string|min:10',
            'coi_confirmed' => 'required|boolean|accepted',
            'override_peer_review' => 'nullable|boolean',
        ]);

        // Default workflow requires at least one completed peer review before approving formal findings (PUB-04)
        if ($validated['decision'] === 'approve' && empty($validated['override_peer_review'])) {
            $completedReviewsCount = ReviewAssignment::where('submission_id', $submission->id)
                ->whereNotNull('completed_at')
                ->count();

            if ($completedReviewsCount === 0) {
                return $this->errorResponse('Default workflow requires at least one completed peer review before approving formal findings (PUB-04).', 'PEER_REVIEW_REQUIRED', 422);
            }
        }

        $editorialDecision = EditorialDecision::updateOrCreate(
            ['submission_id' => $submission->id],
            [
                'editor_id' => $user->id,
                'decision' => $validated['decision'],
                'decision_notes' => $validated['decision_notes'],
                'coi_confirmed' => $validated['coi_confirmed'] ?? true,
                'decided_at' => now(),
            ]
        );

        $newStatus = match ($validated['decision']) {
            'approve' => 'approved',
            'request_revisions' => 'revision_requested',
            'reject' => 'rejected',
        };

        $submission->update(['status' => $newStatus]);

        $this->auditService->record(
            $user->id,
            'editorial_decision',
            'submission',
            $submission->id,
            ['decision' => $validated['decision']],
            $request->ip()
        );

        return $this->successResponse([
            'decision' => $editorialDecision->load('editor'),
            'submission_status' => $newStatus,
        ], "Editorial decision [{$validated['decision']}] recorded.");
    }

    /**
     * Release approved submission as a public peer-reviewed publication (PUB-07, PUB-08, PUB-12).
     */
    public function releasePublication(Request $request, int $id): JsonResponse
    {
        if ($res = $this->checkEditor($request)) return $res;

        $submission = Submission::with('project')->findOrFail($id);

        if ($submission->status !== 'approved') {
            return $this->errorResponse('Only approved submissions can be released to the public research portal.', 'NOT_APPROVED', 422);
        }

        $validated = $request->validate([
            'public_slug' => 'required|string|max:255|unique:publications,public_slug',
            'version_string' => 'nullable|string|max:50',
            'doi' => 'nullable|string|max:100|regex:/^10\.\d{4,9}\/[-._;()\/:A-Za-z0-9]+$/',
            'license' => 'nullable|string|max:100',
        ]);

        // Do not invent a DOI; store null unless validly provided (C-30)
        $doi = !empty($validated['doi']) ? $validated['doi'] : null;
        $license = $validated['license'] ?? ($submission->rights_declaration ?? 'CC-BY-4.0');

        $publication = Publication::create([
            'project_id' => $submission->project_id,
            'submission_id' => $submission->id,
            'public_slug' => Str::slug($validated['public_slug']),
            'doi' => $doi,
            'title' => $submission->title,
            'abstract' => $submission->abstract,
            'published_content' => $submission->frozen_package,
            'version_string' => $validated['version_string'] ?? '1.0.0',
            'license' => $license,
            'status' => 'published',
            'released_by' => $request->user()->id,
            'released_at' => now(),
        ]);

        $this->auditService->record(
            $request->user()->id,
            'release_publication',
            'publication',
            $publication->id,
            ['public_slug' => $publication->public_slug, 'doi' => $doi, 'title' => $publication->title],
            $request->ip()
        );

        return $this->successResponse(
            $publication->load(['project', 'releaser']),
            'Research publication released to the public domain.',
            201
        );
    }

    /**
     * Add versioned post-publication corrigendum or errata notice (PUB-10).
     */
    public function addCorrigendum(Request $request, int $id): JsonResponse
    {
        if ($res = $this->checkEditor($request)) return $res;

        $publication = Publication::findOrFail($id);

        $validated = $request->validate([
            'notice' => 'required|string|min:10',
            'new_version_string' => 'required|string|max:50',
            'affected_sections' => 'nullable|array',
        ]);

        $corrigenda = $publication->corrigenda ?? [];
        $corrigenda[] = [
            'id' => count($corrigenda) + 1,
            'editor_id' => $request->user()->id,
            'previous_version' => $publication->version_string,
            'new_version' => $validated['new_version_string'],
            'notice' => $validated['notice'],
            'affected_sections' => $validated['affected_sections'] ?? [],
            'created_at' => now()->toIso8601String(),
        ];

        $publication->update([
            'version_string' => $validated['new_version_string'],
            'corrigenda' => $corrigenda,
        ]);

        $this->auditService->record(
            $request->user()->id,
            'add_corrigendum',
            'publication',
            $publication->id,
            ['new_version' => $validated['new_version_string'], 'notice' => $validated['notice']],
            $request->ip()
        );

        return $this->successResponse($publication, 'Corrigendum added and publication version updated.');
    }

    /**
     * Retract a publication while preserving transparent public status and reason (PUB-11).
     */
    public function retractPublication(Request $request, int $id): JsonResponse
    {
        if ($res = $this->checkEditor($request)) return $res;

        $publication = Publication::findOrFail($id);

        $validated = $request->validate([
            'retraction_reason' => 'required|string|min:10',
        ]);

        $publication->update([
            'status' => 'retracted',
            'retraction_reason' => $validated['retraction_reason'],
            'retracted_at' => now(),
        ]);

        $this->auditService->record(
            $request->user()->id,
            'retract_publication',
            'publication',
            $publication->id,
            ['reason' => $validated['retraction_reason']],
            $request->ip()
        );

        return $this->successResponse($publication, 'Publication retracted with public status preserved.');
    }

    /**
     * Export formal citation in BibTeX, RIS, or APA format (PUB-08, C-32).
     */
    public function citationExport(Request $request, string $slug): JsonResponse
    {
        $publication = Publication::where('public_slug', $slug)
            ->with(['project.owner'])
            ->firstOrFail();

        $format = strtolower($request->input('format', 'bibtex'));
        $author = $publication->project?->owner?->display_name ?? 'Open Hadith Scholar';
        $year = $publication->released_at ? $publication->released_at->format('Y') : date('Y');
        $title = $publication->title;
        $doi = $publication->doi;
        $doiLine = $doi ? "https://doi.org/{$doi}" : url("/public/research/{$publication->public_slug}");

        $citation = match ($format) {
            'ris' => "TY  - JOUR\nAU  - {$author}\nTI  - {$title}\nJO  - Open Hadith Research Platform\nPY  - {$year}\n" . ($doi ? "DO  - {$doi}\n" : '') . "UR  - {$doiLine}\nER  -",
            'apa' => "{$author}. ({$year}). {$title}. Open Hadith Research Platform." . ($doi ? " https://doi.org/{$doi}" : " {$doiLine}"),
            default => "@article{openhadith_{$publication->public_slug},\n  author = {{$author}},\n  title = {{$title}},\n  journal = {Open Hadith Research Platform},\n  year = {{$year}},\n" . ($doi ? "  doi = {{$doi}},\n" : '') . "  url = {{$doiLine}}\n}",
        };

        return $this->successResponse([
            'format' => $format,
            'citation' => $citation,
            'doi' => $doi,
        ]);
    }

    /**
     * Get single submission details for editor (API-14).
     */
    public function getSubmission(Request $request, int $id): JsonResponse
    {
        if ($res = $this->checkEditor($request)) return $res;

        $submission = Submission::with([
            'project.owner:id,display_name',
            'submitter:id,display_name',
            'reviews.reviewer:id,display_name',
            'decision.editor:id,display_name',
            'publication',
        ])->findOrFail($id);

        return $this->successResponse($submission);
    }

    /**
     * Get candidate peer reviewers with COI analysis (API-14).
     */
    public function getReviewerCandidates(Request $request, int $id): JsonResponse
    {
        if ($res = $this->checkEditor($request)) return $res;

        $submission = Submission::with('project.memberships')->findOrFail($id);
        $project = $submission->project;

        $teamUserIds = $project ? $project->memberships()->pluck('user_id')->toArray() : [];
        if ($project) {
            $teamUserIds[] = $project->owner_id;
        }
        $teamUserIds[] = $submission->submitted_by;
        $teamUserIds = array_unique($teamUserIds);

        // Fetch approved scholars
        $scholars = User::where('status', 'approved')->get();
        $candidates = [];

        foreach ($scholars as $sch) {
            $isConflicted = in_array($sch->id, $teamUserIds);
            $priorReviewCount = ReviewAssignment::where('reviewer_id', $sch->id)->count();

            $candidates[] = [
                'id' => $sch->id,
                'display_name' => $sch->display_name,
                'affiliation' => $sch->profile?->affiliation ?? 'Scholar',
                'prior_reviews_count' => $priorReviewCount,
                'coi' => [
                    'blocked' => $isConflicted,
                    'reason' => $isConflicted ? "Conflict: author or project team member on PRJ-{$submission->project_id}" : null,
                ],
            ];
        }

        return $this->successResponse($candidates);
    }

    /**
     * Reviewer side: list assigned review assignments (API-14).
     */
    public function listReviewerAssignments(Request $request): JsonResponse
    {
        $assignments = ReviewAssignment::where('reviewer_id', $request->user()->id)
            ->with(['submission:id,title,abstract,version_number,project_id,status'])
            ->latest('created_at')
            ->get();

        return $this->successResponse($assignments);
    }

    /**
     * Reviewer side: get single assignment with blinded frozen research package (API-14 / C-31 P0).
     */
    public function getReviewerAssignment(Request $request, int $id): JsonResponse
    {
        $assignment = ReviewAssignment::where('reviewer_id', $request->user()->id)
            ->with(['submission'])
            ->findOrFail($id);

        $sub = $assignment->submission;
        $frozen = $sub?->frozen_package ?? [];

        // Blind documents and findings in frozen package
        $blindedDocs = [];
        if (!empty($frozen['documents'])) {
            foreach ($frozen['documents'] as $doc) {
                $docArray = is_array($doc) ? $doc : (array)$doc;
                unset($docArray['author_id'], $docArray['author'], $docArray['project_id']);
                if (isset($docArray['latest_version'])) {
                    $lv = is_array($docArray['latest_version']) ? $docArray['latest_version'] : (array)$docArray['latest_version'];
                    unset($lv['author_id'], $lv['author']);
                    $docArray['latest_version'] = $lv;
                }
                $blindedDocs[] = $docArray;
            }
        }

        $blindedFindings = [];
        if (!empty($frozen['findings'])) {
            foreach ($frozen['findings'] as $f) {
                $fArray = is_array($f) ? $f : (array)$f;
                unset($fArray['project_id'], $fArray['created_by']);
                if (!empty($fArray['evidence_items'])) {
                    $blindedEv = [];
                    foreach ($fArray['evidence_items'] as $ev) {
                        $evArr = is_array($ev) ? $ev : (array)$ev;
                        unset($evArr['collector_id'], $evArr['collector'], $evArr['project_id']);
                        $blindedEv[] = $evArr;
                    }
                    $fArray['evidence_items'] = $blindedEv;
                }
                $blindedFindings[] = $fArray;
            }
        }

        $blindedPackage = [
            'abstract' => $frozen['abstract'] ?? $sub?->abstract,
            'exported_at' => $frozen['exported_at'] ?? null,
            'documents' => $blindedDocs,
            'findings' => $blindedFindings,
        ];

        $blindedSubmission = $sub ? [
            'id' => $sub->id,
            'title' => $sub->title,
            'abstract' => $sub->abstract,
            'version_number' => $sub->version_number,
            'status' => $sub->status,
            'rights_declaration' => $sub->rights_declaration,
            'keywords' => $sub->keywords ?? [],
            'package_checksum' => $sub->package_checksum,
            'submitted_at' => $sub->submitted_at?->toIso8601String(),
            'frozen_package' => $blindedPackage,
        ] : null;

        $responsePayload = [
            'id' => $assignment->id,
            'submission_id' => $assignment->submission_id,
            'reviewer_id' => $assignment->reviewer_id,
            'status' => $assignment->status ?? 'invited',
            'due_date' => $assignment->due_date?->toIso8601String(),
            'coi_confirmed' => (bool)$assignment->coi_confirmed,
            'completed_at' => $assignment->completed_at?->toIso8601String(),
            'recommendation' => $assignment->recommendation,
            'score' => $assignment->score,
            'reviewer_notes' => $assignment->reviewer_notes,
            'submission' => $blindedSubmission,
        ];

        return $this->successResponse($responsePayload);
    }

    /**
     * Reviewer side: declare COI status (API-14).
     */
    public function declareCoi(Request $request, int $id): JsonResponse
    {
        $assignment = ReviewAssignment::where('reviewer_id', $request->user()->id)->findOrFail($id);

        $validated = $request->validate([
            'coi_confirmed' => 'required|boolean',
            'coi_notes' => 'nullable|string',
        ]);

        $assignment->update([
            'coi_confirmed' => $validated['coi_confirmed'],
        ]);

        return $this->successResponse($assignment, 'Conflict of interest declaration recorded.');
    }

    /**
     * Reviewer side: accept review assignment (API-14 / C-31).
     */
    public function acceptAssignment(Request $request, int $id): JsonResponse
    {
        $assignment = ReviewAssignment::where('reviewer_id', $request->user()->id)->findOrFail($id);
        $assignment->update([
            'status' => 'accepted',
            'coi_confirmed' => true,
        ]);

        return $this->successResponse($assignment, 'Review assignment accepted.');
    }

    /**
     * Reviewer side: decline review assignment (API-14 / C-31).
     */
    public function declineAssignment(Request $request, int $id): JsonResponse
    {
        $assignment = ReviewAssignment::where('reviewer_id', $request->user()->id)->findOrFail($id);
        $assignment->update([
            'status' => 'declined',
            'declined_reason' => $request->input('reason'),
            'declined_at' => now(),
        ]);

        return $this->successResponse($assignment, 'Review assignment declined.');
    }

    /**
     * Helper to format public publication with whitelisted fields only (DEF-5).
     */
    private function formatPublicPublication(Publication $pub): array
    {
        $owner = $pub->project?->owner;
        $profile = $owner?->profile;
        $publicFields = $profile?->public_fields ?? [];

        $ownerData = null;
        if ($owner) {
            $ownerData = [
                'display_name' => $owner->display_name,
            ];
            if (!empty($publicFields['affiliation']) && !empty($profile->affiliation)) {
                $ownerData['affiliation'] = $profile->affiliation;
            }
            if (!empty($publicFields['biography']) && !empty($profile->biography)) {
                $ownerData['biography'] = $profile->biography;
            }
        }

        $submissionData = null;
        if ($pub->submission) {
            $decision = $pub->submission->decision;
            $submissionData = [
                'version_number' => $pub->submission->version_number,
                'decision' => $decision ? [
                    'decision' => $decision->decision,
                    'rationale' => $decision->rationale,
                    'decided_at' => $decision->decided_at?->toIso8601String() ?? $decision->created_at?->toIso8601String(),
                ] : null,
                'reviews' => $pub->submission->reviews ? $pub->submission->reviews->map(function ($r) {
                    return [
                        'recommendation' => $r->recommendation,
                        'submitted_at' => $r->completed_at?->toIso8601String() ?? $r->created_at?->toIso8601String(),
                    ];
                })->values()->all() : [],
            ];
        }

        return [
            'public_slug' => $pub->public_slug,
            'doi' => $pub->doi,
            'title' => $pub->title,
            'abstract' => $pub->abstract,
            'version_string' => $pub->version_string,
            'license' => $pub->license,
            'status' => $pub->status,
            'retraction_reason' => $pub->retraction_reason,
            'retracted_at' => $pub->retracted_at?->toIso8601String(),
            'corrigenda' => $pub->corrigenda ?? [],
            'released_at' => $pub->released_at?->toIso8601String(),
            'project' => $pub->project ? [
                'title' => $pub->project->title,
                'scope' => $pub->project->scope,
                'stage' => $pub->project->stage,
                'owner' => $ownerData,
            ] : null,
            'submission' => $submissionData,
            'published_content' => $pub->published_content,
        ];
    }

    /**
     * Public Research Portal: Browse peer-reviewed publications (PUB-08, PUB-09, DEF-5).
     */
    public function listPublicResearch(Request $request): JsonResponse
    {
        $query = Publication::where('status', '!=', 'hidden')
            ->with(['project.owner.profile', 'releaser']);

        $status = $request->input('status', 'published');
        if ($status !== 'all') {
            $query->where('status', $status);
        }

        if ($request->filled('q')) {
            $term = $request->input('q');
            $query->where(function ($q) use ($term) {
                $q->where('title', 'ILIKE', "%{$term}%")
                  ->orWhere('abstract', 'ILIKE', "%{$term}%");
            });
        }

        $perPage = min((int) ($request->input('per_page', 20)), 100);
        $publications = $query->latest('released_at')->paginate($perPage);

        return $this->paginatedResponse($publications, 'Success', fn($p) => $this->formatPublicPublication($p));
    }

    /**
     * Public Research Portal: View published monograph/study details by slug (DEF-5).
     */
    public function getPublicResearch(string $slug): JsonResponse
    {
        $publication = Publication::where('public_slug', $slug)
            ->with(['project.owner.profile', 'submission.reviews.reviewer', 'submission.decision.editor', 'releaser'])
            ->first();

        if (!$publication) {
            return $this->errorResponse('Publication not found.', 'NOT_FOUND', 404);
        }

        return $this->successResponse($this->formatPublicPublication($publication));
    }
}
