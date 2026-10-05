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
        $this->policyService->authorizeProject($request->user(), 'publish_announcement', $project);

        $validated = $request->validate([
            'public_slug' => 'required|string|max:255',
            'title' => 'required|string|max:500',
            'summary' => 'required|string',
            'research_stage' => 'required|string|max:50',
            'keywords' => 'nullable|array',
            'status' => 'nullable|string|in:draft,published,unpublished,hidden',
        ]);

        $announcement = Announcement::updateOrCreate(
            ['project_id' => $projectId],
            [
                'public_slug' => $validated['public_slug'],
                'title' => $validated['title'],
                'summary' => $validated['summary'],
                'research_stage' => $validated['research_stage'],
                'keywords' => $validated['keywords'] ?? [],
                'status' => $validated['status'] ?? 'draft',
                'published_at' => ($validated['status'] ?? 'draft') === 'published' ? now() : null,
            ]
        );

        return $this->successResponse($announcement, 'Announcement saved.', 200);
    }

    /**
     * Publish announcement publicly.
     */
    public function publishAnnouncement(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'publish_announcement', $project);

        $announcement = Announcement::where('project_id', $projectId)->firstOrFail();
        $announcement->update([
            'status' => 'published',
            'published_at' => now(),
        ]);

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
     * Helper to format public announcement with whitelisted fields only (DEF-5).
     */
    private function formatPublicAnnouncement(Announcement $a): array
    {
        $owner = $a->project?->owner;
        $profile = $owner?->profile;
        $publicFields = $profile?->public_fields ?? [];

        $ownerData = null;
        if ($owner) {
            $ownerData = [
                'id' => $owner->id,
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
                'id' => $a->project->id,
                'title' => $a->project->title,
                'scope' => $a->project->scope,
                'stage' => $a->project->stage,
                'owner' => $ownerData,
            ];
        }

        return [
            'id' => $a->id,
            'project_id' => $a->project_id,
            'public_slug' => $a->public_slug,
            'title' => $a->title,
            'summary' => $a->summary,
            'research_stage' => $a->research_stage,
            'keywords' => $a->keywords ?? [],
            'status' => $a->status,
            'published_at' => $a->published_at?->toIso8601String(),
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
            $term = $request->input('q');
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
     * Submit research package for peer review (PUB-01, PUB-02, PUB-06, WRT-07).
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
            'rights_declaration' => 'nullable|string|max:100',
            'coi_declared' => 'nullable|boolean',
            'parent_submission_id' => 'nullable|integer|exists:submissions,id',
            'author_response_notes' => 'nullable|string',
            'bypass_warnings' => 'nullable|boolean',
        ]);

        [$isValid, $issues] = $this->validationService->validateForSubmission($project, $validated['document_ids'] ?? []);
        if (!$isValid && empty($validated['bypass_warnings'])) {
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
            $nextVersion = (Submission::where('project_id', $projectId)->max('version_number') ?? 0) + 1;
        }

        $submission = Submission::create([
            'project_id' => $projectId,
            'parent_submission_id' => $validated['parent_submission_id'] ?? null,
            'version_number' => $nextVersion,
            'title' => $validated['title'],
            'abstract' => $validated['abstract'],
            'keywords' => $validated['keywords'] ?? [],
            'rights_declaration' => $validated['rights_declaration'] ?? 'CC-BY-4.0',
            'coi_declared' => $validated['coi_declared'] ?? true,
            'author_response_notes' => $validated['author_response_notes'] ?? null,
            'frozen_package' => $package,
            'package_checksum' => $checksum,
            'status' => 'submitted',
            'submitted_by' => $request->user()->id,
            'submitted_at' => now(),
        ]);

        return $this->successResponse(
            $submission->load(['submitter', 'parentSubmission']),
            'Research submission created and submitted for peer review.',
            201
        );
    }

    /**
     * List submissions for project.
     */
    public function listSubmissions(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $submissions = Submission::where('project_id', $projectId)
            ->with(['submitter', 'reviews', 'decision'])
            ->latest('submitted_at')
            ->get();

        return $this->successResponse($submissions);
    }

    /**
     * Get single submission details.
     */
    public function getSubmission(Request $request, int $projectId, int $id): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $submission = Submission::where('project_id', $projectId)
            ->with(['submitter', 'reviews.reviewer', 'decision'])
            ->find($id);

        if (!$submission) {
            return $this->errorResponse('Submission not found.', 'NOT_FOUND', 404);
        }

        return $this->successResponse($submission);
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
