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
     * Public portal: list published research announcements.
     */
    public function listPublicAnnouncements(Request $request): JsonResponse
    {
        $query = Announcement::where('status', 'published')
            ->with(['project.owner']);

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

        return $this->paginatedResponse($announcements);
    }

    /**
     * Public portal: view published announcement by slug.
     */
    public function getPublicAnnouncement(string $slug): JsonResponse
    {
        $announcement = Announcement::where('public_slug', $slug)
            ->where('status', 'published')
            ->with(['project.owner'])
            ->first();

        if (!$announcement) {
            return $this->errorResponse('Announcement not found.', 'NOT_FOUND', 404);
        }

        return $this->successResponse($announcement);
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
}
