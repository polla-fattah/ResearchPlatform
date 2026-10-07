<?php

namespace App\Http\Controllers\Api;

use App\Models\ResearchProject;
use App\Models\Announcement;
use App\Models\Submission;
use App\Models\Document;
use App\Services\AuthPolicyService;
use App\Services\PublicationValidationService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class PublishingController extends ApiController
{
    public function __construct(
        protected AuthPolicyService $policyService,
        protected PublicationValidationService $validationService = new PublicationValidationService()
    ) {}

    /**
     * Get announcement metadata for a project (Module 8).
     */
    public function getAnnouncement(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $announcement = Announcement::where('project_id', $projectId)->first();

        return $this->successResponse($announcement);
    }

    /**
     * Create or update project announcement.
     */
    public function saveAnnouncement(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);
        $existing = Announcement::where('project_id', $projectId)->first();

        $validated = $request->validate([
            'public_slug' => [
                'required',
                'string',
                'max:255',
                'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/',
                \Illuminate\Validation\Rule::unique('announcements', 'public_slug')->ignore($existing?->id),
            ],
            'title' => 'required|string|max:500',
            'summary' => 'required|string',
            'research_stage' => 'required|string|max:50',
            'keywords' => 'nullable|array',
            'status' => 'nullable|string|in:draft,published,unpublished,hidden',
        ]);

        $newStatus = $validated['status'] ?? ($existing?->status ?? 'draft');
        $publishedAt = $existing?->published_at;
        if ($newStatus === 'published' && !$publishedAt) {
            $publishedAt = now();
        } elseif ($newStatus === 'draft' && isset($validated['status'])) {
            $publishedAt = null;
        }

        $announcement = Announcement::updateOrCreate(
            ['project_id' => $projectId],
            [
                'public_slug' => $validated['public_slug'],
                'title' => $validated['title'],
                'summary' => $validated['summary'],
                'research_stage' => $validated['research_stage'],
                'keywords' => $validated['keywords'] ?? [],
                'status' => $newStatus,
                'published_at' => $publishedAt,
            ]
        );

        \App\Models\ProjectActivity::record($projectId, $request->user()->id, 'announcement_saved', 'announcement', $announcement->id, "Saved the research announcement '{$announcement->title}'");

        return $this->successResponse($announcement, 'Announcement saved.', 200);
    }

    /**
     * Publish announcement publicly.
     */
    public function publishAnnouncement(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'publish_announcement', $project);

        $announcement = Announcement::where('project_id', $projectId)->first();

        // Publishing needs a saved announcement with an address, a title and a summary, and says which are missing.
        $missing = array_values(array_filter(['public_slug', 'title', 'summary'], fn ($field) => trim((string) ($announcement?->{$field} ?? '')) === ''));
        if ($missing) {
            return $this->errorResponse(
                'The announcement is not ready to publish: ' . implode(', ', $missing) . ' missing.',
                'ANNOUNCEMENT_INCOMPLETE',
                422,
                ['missing' => $missing]
            );
        }

        $announcement->update([
            'status' => 'published',
            'published_at' => now(),
        ]);

        \App\Models\ProjectActivity::record($projectId, $request->user()->id, 'announcement_published', 'announcement', $announcement->id, "Published the research announcement '{$announcement->title}'");

        return $this->successResponse($announcement, 'Announcement published to the public portal.');
    }

    /**
     * Unpublish an announcement (API-13).
     */
    public function unpublishAnnouncement(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'publish_announcement', $project);

        $announcement = Announcement::where('project_id', $projectId)->first();
        if (!$announcement) {
            return $this->errorResponse('Announcement not found.', 'NOT_FOUND', 404);
        }

        $announcement->update([
            'status' => 'unpublished',
        ]);

        \App\Models\ProjectActivity::create([
            'project_id' => $projectId,
            'actor_id' => $request->user()->id,
            'action' => 'announcement_unpublished',
            'object_type' => 'announcement',
            'object_id' => $announcement->id,
            'summary' => "Unpublished research announcement '{$announcement->title}'",
            'created_at' => now(),
        ]);

        return $this->successResponse($announcement, 'Announcement unpublished.');
    }

    /**
     * Get announcement history (API-13).
     */
    public function announcementHistory(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $announcement = Announcement::where('project_id', $projectId)->first();
        if (!$announcement) {
            return $this->errorResponse('Announcement not found.', 'NOT_FOUND', 404);
        }

        $activities = \App\Models\ProjectActivity::where('project_id', $projectId)
            ->where('object_type', 'announcement')
            ->with('actor:id,display_name')
            ->latest('created_at')
            ->get();

        return $this->successResponse([
            'announcement' => $announcement,
            'history' => $activities,
        ]);
    }

    /**
     * Helper to format public announcement with whitelisted fields only (DEF-5 / C-27).
     */
    private function formatPublicAnnouncement(Announcement $a): array
    {
        $owner = $a->project?->owner;
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
            if (!empty($publicFields['research_interests']) && !empty($profile->research_interests)) {
                $ownerData['research_interests'] = $profile->research_interests;
            }
        }

        $projectData = null;
        if ($a->project) {
            $projectData = [
                'title' => $a->project->title,
                'scope' => $a->project->scope,
                'stage' => $a->project->stage,
                'owner' => $ownerData,
            ];
        }

        return [
            'id' => $a->id,
            'public_slug' => $a->public_slug,
            'title' => $a->title,
            'summary' => $a->summary,
            'research_stage' => $a->research_stage,
            'keywords' => $a->keywords ?? [],
            'status' => $a->status,
            'published_at' => $a->published_at?->toIso8601String(),
            'updated_at' => $a->updated_at?->toIso8601String(),
            'project' => $projectData,
        ];
    }

    /**
     * Public portal: list published research announcements.
     */
    public function listPublicAnnouncements(Request $request): JsonResponse
    {
        $query = Announcement::where('status', 'published')
            ->with(['project.owner.profile']);

        if ($request->filled('research_stage')) {
            $query->where('research_stage', $request->input('research_stage'));
        }

        if ($request->filled('q')) {
            $term = str_replace(['\\', '%', '_'], ['\\\\', '\%', '\_'], $request->input('q'));
            $query->where(function ($q) use ($term) {
                $q->where('title', 'ILIKE', "%{$term}%")
                  ->orWhere('summary', 'ILIKE', "%{$term}%");
            });
        }

        $perPage = min((int) ($request->input('per_page', 20)), 100);
        $announcements = $query->latest('published_at')->paginate($perPage);

        return $this->paginatedResponse($announcements, 'Success', fn($a) => $this->formatPublicAnnouncement($a));
    }

    /**
     * Public portal: view published announcement by slug.
     */
    public function getPublicAnnouncement(string $slug): JsonResponse
    {
        $announcement = Announcement::where('public_slug', $slug)
            ->where('status', 'published')
            ->with(['project.owner.profile'])
            ->first();

        if (!$announcement) {
            return $this->errorResponse('Announcement not found.', 'NOT_FOUND', 404);
        }

        return $this->successResponse($this->formatPublicAnnouncement($announcement));
    }

    /**
     * Pre-publication validation endpoint (WRT-07, PUB-12).
     */
    public function validatePrePublication(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $docIds = $request->input('document_ids', []);
        [$isValid, $issues] = $this->validationService->validateForSubmission($project, is_array($docIds) ? $docIds : []);

        return $this->successResponse([
            'is_valid' => $isValid,
            'issue_count' => count($issues),
            'issues' => $issues,
        ], $isValid ? 'Submission package passed pre-publication validation.' : 'Validation issues detected.');
    }

    /**
     * Submit research package for peer review (PUB-01, PUB-02, PUB-06, WRT-07, C-29).
     */
    public function createSubmission(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'submit_publication', $project);

        $validated = $request->validate([
            'title' => 'required|string|max:500',
            'abstract' => 'required|string',
            'document_ids' => 'nullable|array',
            'keywords' => 'nullable|array',
            'rights_declaration' => 'required|string|max:100',
            'coi_declared' => 'required|boolean',
            'parent_submission_id' => 'nullable|integer|exists:submissions,id',
            'author_response_notes' => 'nullable|string',
            'bypass_warnings' => 'nullable|boolean',
        ]);

        // Check if an existing package is active/waiting (C-29 concurrency check)
        $latestSub = Submission::where('project_id', $projectId)->latest('version_number')->first();
        if ($latestSub && in_array($latestSub->status, ['submitted', 'in_review', 'under_review', 'approved'])) {
            return $this->errorResponse('Another submission package is currently active or decided. You cannot create a new package until revisions are requested.', 'CONFLICT', 409);
        }

        if (!empty($validated['parent_submission_id'])) {
            if (!$latestSub || $latestSub->id !== (int)$validated['parent_submission_id'] || $latestSub->status !== 'revision_requested') {
                return $this->errorResponse('A new revision can only be submitted when revisions are requested on the latest submission.', 'CONFLICT', 409);
            }
        }

        [$isValid, $issues] = $this->validationService->validateForSubmission($project, $validated['document_ids'] ?? []);
        $hasErrors = count(array_filter($issues, fn($i) => ($i['severity'] ?? 'error') === 'error')) > 0;
        $hasWarnings = count(array_filter($issues, fn($i) => ($i['severity'] ?? 'error') === 'warning')) > 0;

        // bypass_warnings only bypasses warnings; errors always block submission (C-29 P0)
        if ($hasErrors || ($hasWarnings && empty($validated['bypass_warnings']))) {
            return $this->errorResponse('Pre-publication validation failed (WRT-07). Resolve dependencies before submission.', 'VALIDATION_FAILED', 422, $issues);
        }

        $documents = Document::where('project_id', $projectId)
            ->with('latestVersion.citations')
            ->when(!empty($validated['document_ids']), fn($q) => $q->whereIn('id', $validated['document_ids']))
            ->get();

        $findings = $project->findings()->with('evidenceItems')->get();

        $package = [
            'project' => [
                'id' => $project->id,
                'title' => $project->title,
                'question' => $project->question,
                'scope' => $project->scope,
            ],
            'abstract' => $validated['abstract'],
            'documents' => $documents,
            'findings' => $findings,
            'exported_at' => now()->toIso8601String(),
        ];

        $packageJson = json_encode($package);
        $checksum = hash('sha256', $packageJson);

        if (!empty($validated['parent_submission_id'])) {
            $parent = Submission::where('project_id', $projectId)->findOrFail($validated['parent_submission_id']);
            $nextVersion = $parent->version_number + 1;
        } else {
            $nextVersion = ($latestSub ? $latestSub->version_number : 0) + 1;
        }

        $submission = Submission::create([
            'project_id' => $projectId,
            'parent_submission_id' => $validated['parent_submission_id'] ?? null,
            'version_number' => $nextVersion,
            'title' => $validated['title'],
            'abstract' => $validated['abstract'],
            'keywords' => $validated['keywords'] ?? [],
            'rights_declaration' => $validated['rights_declaration'],
            'coi_declared' => $validated['coi_declared'],
            'author_response_notes' => $validated['author_response_notes'] ?? null,
            'frozen_package' => $package,
            'package_checksum' => $checksum,
            'status' => 'submitted',
            'submitted_by' => $request->user()->id,
            'submitted_at' => now(),
        ]);

        return $this->successResponse(
            $this->formatAuthorSubmission($submission),
            'Research submission created and submitted for peer review.',
            201
        );
    }

    /**
     * List submissions for project (author-blinded view).
     */
    public function listSubmissions(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $submissions = Submission::where('project_id', $projectId)
            ->with(['reviews', 'decision'])
            ->latest('submitted_at')
            ->get()
            ->map(fn($s) => $this->formatAuthorSubmission($s));

        return $this->successResponse($submissions);
    }

    /**
     * Get single submission details (author-blinded view).
     */
    public function getSubmission(Request $request, int $projectId, int $id): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $submission = Submission::where('project_id', $projectId)
            ->with(['reviews', 'decision'])
            ->find($id);

        if (!$submission) {
            return $this->errorResponse('Submission not found.', 'NOT_FOUND', 404);
        }

        return $this->successResponse($this->formatAuthorSubmission($submission));
    }

    /**
     * Helper to format submission for authors without leaking reviewer identities or notes (C-29 P0).
     */
    private function formatAuthorSubmission(Submission $sub): array
    {
        return [
            'id' => $sub->id,
            'project_id' => $sub->project_id,
            'parent_submission_id' => $sub->parent_submission_id,
            'version_number' => $sub->version_number,
            'title' => $sub->title,
            'abstract' => $sub->abstract,
            'keywords' => $sub->keywords ?? [],
            'rights_declaration' => $sub->rights_declaration,
            'coi_declared' => (bool)$sub->coi_declared,
            'author_response_notes' => $sub->author_response_notes,
            'package_checksum' => $sub->package_checksum,
            'status' => $sub->status,
            'submitted_at' => $sub->submitted_at?->toIso8601String(),
            'reviews' => $sub->reviews ? $sub->reviews->map(fn($r) => [
                'completed_at' => $r->completed_at?->toIso8601String(),
            ])->values()->all() : [],
            'decision' => $sub->decision ? [
                'decision' => $sub->decision->decision,
                'decision_notes' => $sub->decision->decision_notes,
                'decided_at' => $sub->decision->decided_at?->toIso8601String(),
            ] : null,
        ];
    }

    /**
     * Public researcher directory exposing only whitelisted public_fields (API-13).
     */
    public function listPublicResearchers(Request $request): JsonResponse
    {
        $perPage = min((int)$request->input('per_page', 20), 100);

        $researchers = \App\Models\User::where('status', 'approved')
            ->whereHas('profile', fn($q) => $q->where('is_public', true))
            ->with('profile')
            ->paginate($perPage);

        $formatted = $researchers->getCollection()->map(function ($u) {
            $p = $u->profile;
            $publicFields = $p?->public_fields ?? ['affiliation', 'research_interests'];

            return [
                'id' => $u->id,
                'display_name' => $u->display_name,
                'affiliation' => in_array('affiliation', $publicFields) ? $p?->affiliation : null,
                'research_interests' => in_array('research_interests', $publicFields) ? ($p?->research_interests ?? []) : [],
                'biography' => in_array('biography', $publicFields) ? $p?->biography : null,
            ];
        });

        return response()->json([
            'success' => true,
            'message' => 'Success',
            'data' => $formatted,
            'meta' => [
                'timestamp' => now()->toIso8601String(),
                'version' => 'v1',
                'pagination' => [
                    'current_page' => $researchers->currentPage(),
                    'per_page' => $researchers->perPage(),
                    'total_items' => $researchers->total(),
                    'total_pages' => $researchers->lastPage(),
                    'has_more' => $researchers->hasMorePages(),
                ],
            ],
        ], 200);
    }

    /**
     * Public researcher profile by id (API-13).
     */
    public function getPublicResearcher(int $id): JsonResponse
    {
        $user = \App\Models\User::where('status', 'approved')
            ->whereHas('profile', fn($q) => $q->where('is_public', true))
            ->with('profile')
            ->find($id);

        if (!$user) {
            return $this->errorResponse('Researcher profile not found or private.', 'NOT_FOUND', 404);
        }

        $p = $user->profile;
        $publicFields = $p?->public_fields ?? ['affiliation', 'research_interests', 'biography'];

        return $this->successResponse([
            'id' => $user->id,
            'display_name' => $user->display_name,
            'affiliation' => in_array('affiliation', $publicFields) ? $p?->affiliation : null,
            'research_interests' => in_array('research_interests', $publicFields) ? ($p?->research_interests ?? []) : [],
            'biography' => in_array('biography', $publicFields) ? $p?->biography : null,
            'email' => in_array('email', $publicFields) ? $user->email : null,
        ]);
    }
}
