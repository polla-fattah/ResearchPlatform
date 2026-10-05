<?php

namespace App\Http\Controllers\Api;

use App\Models\ResearchProject;
use App\Models\Document;
use App\Models\DocumentVersion;
use App\Models\Citation;
use App\Services\AuthPolicyService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class DocumentController extends ApiController
{
    public function __construct(
        protected AuthPolicyService $policyService
    ) {}

    /**
     * List documents in a project workspace (Module 7).
     */
    public function index(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $query = Document::where('project_id', $projectId)
            ->with(['latestVersion.author']);

        if ($request->filled('document_type')) {
            $query->where('document_type', $request->input('document_type'));
        }

        if ($request->filled('q')) {
            $term = $request->input('q');
            $query->where('title', 'ILIKE', "%{$term}%");
        }

        $perPage = min((int) ($request->input('per_page', 20)), 100);
        $documents = $query->latest('updated_at')->paginate($perPage);

        return $this->paginatedResponse($documents);
    }

    /**
     * Create a new research manuscript or dossier.
     */
    public function store(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'write_document', $project);

        $validated = $request->validate([
            'title' => 'required|string|max:500',
            'document_type' => 'nullable|string|in:article,dossier,dataset_note',
            'language' => 'nullable|string|max:10',
            'content' => 'required|string',
            'change_summary' => 'nullable|string',
        ]);

        $document = DB::transaction(function () use ($projectId, $validated, $request) {
            $doc = Document::create([
                'project_id' => $projectId,
                'title' => $validated['title'],
                'document_type' => $validated['document_type'] ?? 'article',
                'language' => $validated['language'] ?? 'ar',
            ]);

            DocumentVersion::create([
                'document_id' => $doc->id,
                'version_number' => 1,
                'content' => $validated['content'],
                'author_id' => $request->user()->id,
                'change_summary' => $validated['change_summary'] ?? 'Initial draft',
                'created_at' => now(),
            ]);

            return $doc;
        });

        return $this->successResponse(
            $document->load('latestVersion.author'),
            'Document draft created.',
            201
        );
    }

    /**
     * Show document details with latest content.
     */
    public function show(Request $request, int $projectId, int $id): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $document = Document::where('project_id', $projectId)
            ->with(['latestVersion.author', 'latestVersion.citations.resource', 'findings'])
            ->find($id);

        if (!$document) {
            return $this->errorResponse('Document not found.', 'NOT_FOUND', 404);
        }

        return $this->successResponse($document);
    }

    /**
     * Update document metadata.
     */
    public function update(Request $request, int $projectId, int $id): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $document = Document::where('project_id', $projectId)->find($id);
        if (!$document) {
            return $this->errorResponse('Document not found.', 'NOT_FOUND', 404);
        }

        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:500',
            'document_type' => 'nullable|string|in:article,dossier,dataset_note',
            'language' => 'nullable|string|max:10',
        ]);

        $document->update($validated);

        return $this->successResponse($document->fresh(['latestVersion', 'findings']), 'Document metadata updated.');
    }

    /**
     * Delete document and all version history.
     */
    public function destroy(Request $request, int $projectId, int $id): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $document = Document::where('project_id', $projectId)->find($id);
        if (!$document) {
            return $this->errorResponse('Document not found.', 'NOT_FOUND', 404);
        }

        $document->delete();

        return $this->successResponse(null, 'Document deleted.');
    }

    /**
     * Save uncommitted per-user draft (autosave).
     */
    public function saveDraft(Request $request, int $projectId, int $id): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $document = Document::where('project_id', $projectId)->find($id);
        if (!$document) {
            return $this->errorResponse('Document not found.', 'NOT_FOUND', 404);
        }

        $validated = $request->validate([
            'content' => 'required|string',
            'base_version' => 'nullable|integer',
        ]);

        $userId = $request->user()->id;
        $draftData = [
            'content' => $validated['content'],
            'base_version' => $validated['base_version'] ?? null,
            'saved_at' => now()->toIso8601String(),
            'author_id' => $userId,
            'author_name' => $request->user()->display_name,
        ];

        // Store uncommitted per-user draft so collaborators do not overwrite each other (C-10)
        cache()->put("doc_draft:{$document->id}:{$userId}", $draftData, now()->addDays(30));

        $document->update([
            'draft_content' => $validated['content'],
            'draft_base_version' => $validated['base_version'] ?? null,
            'draft_saved_at' => now(),
            'draft_author_id' => $userId,
        ]);

        return $this->successResponse([
            'last_saved_at' => $document->draft_saved_at,
            'saved_by' => $request->user()->display_name,
            'draft_base_version' => $document->draft_base_version,
        ], 'Draft autosaved.');
    }

    /**
     * Get currently stored draft (per user with document fallback).
     */
    public function getDraft(Request $request, int $projectId, int $id): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $document = Document::where('project_id', $projectId)->find($id);
        if (!$document) {
            return $this->errorResponse('Document not found.', 'NOT_FOUND', 404);
        }

        $userId = $request->user()->id;
        $userDraft = cache()->get("doc_draft:{$document->id}:{$userId}");

        if ($userDraft) {
            return $this->successResponse([
                'draft_content' => $userDraft['content'],
                'draft_base_version' => $userDraft['base_version'],
                'last_saved_at' => $userDraft['saved_at'],
                'saved_by_id' => $userDraft['author_id'],
            ]);
        }

        return $this->successResponse([
            'draft_content' => $document->draft_content,
            'draft_base_version' => $document->draft_base_version,
            'last_saved_at' => $document->draft_saved_at,
            'saved_by_id' => $document->draft_author_id,
        ]);
    }

    /**
     * Commit a new revision/version snapshot of the document.
     */
    public function createVersion(Request $request, int $projectId, int $id): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $document = Document::where('project_id', $projectId)->find($id);
        if (!$document) {
            return $this->errorResponse('Document not found.', 'NOT_FOUND', 404);
        }

        $latestVersion = $document->latestVersion;
        $currentVersionNumber = $latestVersion ? $latestVersion->version_number : 0;

        // DEF-8 Optimistic Concurrency check
        $expectedVersion = $request->input('expected_version');
        if ($expectedVersion !== null && (int)$expectedVersion !== $currentVersionNumber) {
            return $this->errorResponse(
                'Save rejected · conflict. Another researcher saved a new revision in the meantime.',
                'CONFLICT',
                409,
                [
                    'current_version' => $currentVersionNumber,
                    'current_content' => $latestVersion?->content,
                    'current_author' => $latestVersion?->author?->display_name,
                    'saved_at' => $latestVersion?->created_at?->toIso8601String(),
                ]
            );
        }

        $validated = $request->validate([
            'content' => 'required|string',
            'change_summary' => 'nullable|string',
            'expected_version' => 'nullable|integer',
            'citations' => 'nullable|array',
            'citations.*.resource_id' => 'required_with:citations|integer|exists:resources,id',
            'citations.*.evidence_id' => 'nullable|integer|exists:evidence_items,id',
            'citations.*.locator' => 'nullable|string|max:255',
            'citations.*.citation_type' => 'nullable|string|in:direct_quotation,paraphrase,reference',
            'citations.*.formatted_citation' => 'required_with:citations|string',
        ]);

        $version = DB::transaction(function () use ($document, $validated, $request) {
            $nextVersionNumber = ($document->versions()->max('version_number') ?? 0) + 1;

            $version = DocumentVersion::create([
                'document_id' => $document->id,
                'version_number' => $nextVersionNumber,
                'content' => $validated['content'],
                'author_id' => $request->user()->id,
                'change_summary' => $validated['change_summary'] ?? "Revision {$nextVersionNumber}",
                'created_at' => now(),
            ]);

            if (!empty($validated['citations'])) {
                foreach ($validated['citations'] as $cit) {
                    Citation::create([
                        'document_version_id' => $version->id,
                        'resource_id' => $cit['resource_id'],
                        'evidence_id' => $cit['evidence_id'] ?? null,
                        'locator' => $cit['locator'] ?? null,
                        'citation_type' => $cit['citation_type'] ?? 'direct_quotation',
                        'formatted_citation' => $cit['formatted_citation'],
                        'created_at' => now(),
                    ]);
                }
            }

            // Clear draft once version is committed
            $document->update([
                'draft_content' => null,
                'draft_base_version' => null,
                'draft_saved_at' => null,
            ]);

            $document->touch();

            return $version;
        });

        return $this->successResponse(
            $version->load(['author', 'citations.resource']),
            'New document version committed.',
            201
        );
    }

    /**
     * Restore a historical revision as a new head version.
     */
    public function restoreVersion(Request $request, int $projectId, int $id, int $versionNumber): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $document = Document::where('project_id', $projectId)->find($id);
        if (!$document) {
            return $this->errorResponse('Document not found.', 'NOT_FOUND', 404);
        }

        $targetVersion = DocumentVersion::where('document_id', $id)
            ->where('version_number', $versionNumber)
            ->with('citations')
            ->first();

        if (!$targetVersion) {
            return $this->errorResponse('Historical document version not found.', 'NOT_FOUND', 404);
        }

        $newVersion = DB::transaction(function () use ($document, $targetVersion, $versionNumber, $request) {
            $nextVersionNumber = ($document->versions()->max('version_number') ?? 0) + 1;

            $version = DocumentVersion::create([
                'document_id' => $document->id,
                'version_number' => $nextVersionNumber,
                'content' => $targetVersion->content,
                'author_id' => $request->user()->id,
                'change_summary' => "Restored from version {$versionNumber}",
                'created_at' => now(),
            ]);

            foreach ($targetVersion->citations as $cit) {
                Citation::create([
                    'document_version_id' => $version->id,
                    'resource_id' => $cit->resource_id,
                    'evidence_id' => $cit->evidence_id,
                    'locator' => $cit->locator,
                    'citation_type' => $cit->citation_type,
                    'formatted_citation' => $cit->formatted_citation,
                    'created_at' => now(),
                ]);
            }

            $document->touch();
            return $version;
        });

        return $this->successResponse(
            $newVersion->load(['author', 'citations.resource']),
            "Version {$versionNumber} restored as revision {$newVersion->version_number}.",
            201
        );
    }

    /**
     * Helper to format a citation and flag missing components.
     */
    public function cite(Request $request, int $projectId, int $id): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $validated = $request->validate([
            'evidence_id' => 'required|integer|exists:evidence_items,id',
            'mode' => 'nullable|string|in:direct_quotation,paraphrase,reference',
            'style' => 'nullable|string|max:50',
        ]);

        $evidence = \App\Models\EvidenceItem::with('resource')->findOrFail($validated['evidence_id']);
        $resource = $evidence->resource;

        $missing = [];
        $locator = $evidence->locator ?? '';
        if (empty($locator)) {
            $missing[] = 'page_or_hadith_number';
        }

        $resTitle = $resource?->title ?? 'Unknown Source';
        $resAuthor = $resource?->metadata['author'] ?? null;
        if (!$resAuthor) {
            $missing[] = 'author';
        }
        $resYear = $resource?->metadata['publication_year'] ?? null;
        if (!$resYear) {
            $missing[] = 'year';
        }

        $citationType = $validated['mode'] ?? 'reference';
        $formatted = sprintf(
            '%s%s%s',
            $resAuthor ? "{$resAuthor}, " : '',
            "_{$resTitle}_",
            $locator ? ", {$locator}" : ''
        );

        return $this->successResponse([
            'evidence_id' => $evidence->id,
            'resource_id' => $resource?->id,
            'citation_type' => $citationType,
            'formatted_citation' => $formatted,
            'missing_components' => $missing,
            'has_incomplete_citation' => !empty($missing),
        ]);
    }

    /**
     * Link finding to document.
     */
    public function linkFinding(Request $request, int $projectId, int $id, int $findingId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $document = Document::where('project_id', $projectId)->find($id);
        if (!$document) {
            return $this->errorResponse('Document not found.', 'NOT_FOUND', 404);
        }

        $finding = \App\Models\Finding::where('project_id', $projectId)->find($findingId);
        if (!$finding) {
            return $this->errorResponse('Finding not found.', 'NOT_FOUND', 404);
        }

        $document->findings()->syncWithoutDetaching([$findingId]);

        return $this->successResponse(
            $document->fresh('findings'),
            'Finding linked to document.'
        );
    }

    /**
     * Unlink finding from document.
     */
    public function unlinkFinding(Request $request, int $projectId, int $id, int $findingId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $document = Document::where('project_id', $projectId)->find($id);
        if (!$document) {
            return $this->errorResponse('Document not found.', 'NOT_FOUND', 404);
        }

        $document->findings()->detach($findingId);

        return $this->successResponse(
            $document->fresh('findings'),
            'Finding unlinked from document.'
        );
    }

    /**
     * List version history / changelog.
     */
    public function listVersions(Request $request, int $projectId, int $id): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $document = Document::where('project_id', $projectId)->find($id);
        if (!$document) {
            return $this->errorResponse('Document not found.', 'NOT_FOUND', 404);
        }

        $versions = $document->versions()
            ->with(['author', 'citations'])
            ->get();

        return $this->successResponse($versions);
    }

    /**
     * Get a specific historical revision by version number.
     */
    public function getVersion(Request $request, int $projectId, int $id, int $versionNumber): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $version = DocumentVersion::where('document_id', $id)
            ->where('version_number', $versionNumber)
            ->with(['author', 'citations.resource', 'citations.evidence'])
            ->first();

        if (!$version) {
            return $this->errorResponse('Document version not found.', 'NOT_FOUND', 404);
        }

        return $this->successResponse($version);
    }
}

