<?php

namespace App\Http\Controllers\Api;

use App\Models\ResearchProject;
use App\Models\Document;
use App\Models\ProjectActivity;
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
     * Format a document version ensuring author identity is strictly { id, display_name } (C-18).
     */
    protected function formatVersion(?DocumentVersion $version): ?array
    {
        if (!$version) {
            return null;
        }

        return [
            'id' => $version->id,
            'document_id' => $version->document_id,
            'version_number' => $version->version_number,
            'content' => $version->content,
            'change_summary' => $version->change_summary,
            'created_at' => $version->created_at?->toIso8601String(),
            'author' => $version->author ? [
                'id' => $version->author->id,
                'display_name' => $version->author->display_name,
            ] : null,
            'citations' => $version->citations ? $version->citations->map(fn($c) => [
                'id' => $c->id,
                'evidence_id' => $c->evidence_id,
                'resource_id' => $c->resource_id,
                'locator' => $c->locator,
                'citation_type' => $c->citation_type,
                'formatted_citation' => $c->formatted_citation,
                'resource' => $c->resource ? [
                    'id' => $c->resource->id,
                    'title' => $c->resource->title,
                    'author' => $c->resource->author,
                ] : null,
                'evidence' => $c->evidence ? [
                    'id' => $c->evidence->id,
                    'captured_text' => $c->evidence->captured_text,
                    'locator' => $c->evidence->locator,
                ] : null,
            ])->values()->all() : [],
        ];
    }

    /**
     * Format a document model for frontend schema compliance without leaks (C-18).
     */
    protected function formatDocument(Document $document): array
    {
        return [
            'id' => $document->id,
            'project_id' => $document->project_id,
            'title' => $document->title,
            'document_type' => $document->document_type,
            'language' => $document->language,
            'lock_version' => $document->lock_version,
            'locked_by' => $document->locked_by,
            'locked_at' => $document->locked_at?->toIso8601String(),
            'created_at' => $document->created_at?->toIso8601String(),
            'updated_at' => $document->updated_at?->toIso8601String(),
            'latest_version' => $this->formatVersion($document->latestVersion),
            'findings' => $document->findings ? $document->findings->map(fn($f) => [
                'id' => $f->id,
                'claim' => $f->claim,
                'status' => $f->status,
            ])->values()->all() : [],
        ];
    }

    /**
     * List documents in a project workspace (Module 7).
     */
    public function index(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $query = Document::where('project_id', $projectId)
            ->with(['latestVersion.author', 'findings']);

        if ($request->filled('document_type')) {
            $query->where('document_type', $request->input('document_type'));
        }

        if ($request->filled('q')) {
            $term = $request->input('q');
            $query->where('title', 'ILIKE', "%{$term}%");
        }

        $perPage = min((int) ($request->input('per_page', 20)), 100);
        $paginator = $query->latest('updated_at')->paginate($perPage);
        $paginator->getCollection()->transform(fn($doc) => $this->formatDocument($doc));

        return $this->paginatedResponse($paginator);
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

        ProjectActivity::record($projectId, $request->user()->id, 'document_created', 'document', $document->id, "Started the document '{$document->title}'");

        return $this->successResponse(
            $this->formatDocument($document->load(['latestVersion.author', 'findings'])),
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
            ->with(['latestVersion.author', 'latestVersion.citations.resource', 'latestVersion.citations.evidence', 'findings'])
            ->find($id);

        if (!$document) {
            return $this->errorResponse('Document not found.', 'NOT_FOUND', 404);
        }

        return $this->successResponse($this->formatDocument($document));
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

        ProjectActivity::record($projectId, $request->user()->id, 'document_updated', 'document', $document->id, "Changed the details of the document '{$document->title}'");

        return $this->successResponse(
            $this->formatDocument($document->fresh(['latestVersion.author', 'findings'])),
            'Document metadata updated.'
        );
    }

    /**
     * Delete document and all version history with dependency guard (C-18).
     */
    public function destroy(Request $request, int $projectId, int $id): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $document = Document::where('project_id', $projectId)->find($id);
        if (!$document) {
            return $this->errorResponse('Document not found.', 'NOT_FOUND', 404);
        }

        $hasFindings = $document->findings()->exists();
        $hasCitations = Citation::whereIn('document_version_id', $document->versions()->pluck('id'))->exists();

        if (($hasFindings || $hasCitations) && !$request->boolean('confirm')) {
            return $this->errorResponse(
                'Document has linked findings or citations. Pass confirm=true to force delete.',
                'HAS_DEPENDENCIES',
                409,
                [
                    'has_findings' => $hasFindings,
                    'has_citations' => $hasCitations,
                ]
            );
        }

        $document->delete();

        ProjectActivity::record($projectId, $request->user()->id, 'document_deleted', 'document', $id, "Deleted the document '{$document->title}'");

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
        $document->refresh();

        return $this->successResponse([
            'last_saved_at' => $document->draft_saved_at?->toIso8601String(),
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
            'last_saved_at' => $document->draft_saved_at?->toIso8601String(),
            'saved_by_id' => $document->draft_author_id,
        ]);
    }

    /**
     * Commit a new revision/version snapshot of the document (C-18).
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

        $validated = $request->validate([
            'content' => 'required|string',
            'change_summary' => 'nullable|string',
            'expected_version' => 'required|integer',
            'citations' => 'nullable|array',
            'citations.*.resource_id' => 'required_with:citations|integer|exists:resources,id',
            'citations.*.evidence_id' => 'nullable|integer|exists:evidence_items,id',
            'citations.*.locator' => 'nullable|string|max:255',
            'citations.*.citation_type' => 'nullable|string|in:direct_quotation,paraphrase,reference',
            'citations.*.formatted_citation' => 'required_with:citations|string',
        ]);

        // DEF-8 Optimistic Concurrency check
        if ((int)$validated['expected_version'] !== $currentVersionNumber) {
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

        // Scope all evidence citations to the current project (C-18)
        if (!empty($validated['citations'])) {
            $evidenceIds = array_filter(array_column($validated['citations'], 'evidence_id'));
            if (!empty($evidenceIds)) {
                $count = \App\Models\EvidenceItem::where('project_id', $projectId)
                    ->whereIn('id', $evidenceIds)
                    ->count();
                if ($count !== count(array_unique($evidenceIds))) {
                    return $this->errorResponse(
                        'One or more evidence citations do not belong to this project.',
                        'EVIDENCE_NOT_IN_PROJECT',
                        422
                    );
                }
            }
        }

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

            // Clear per-person draft cache and document draft columns on commit (C-18)
            $userId = $request->user()->id;
            cache()->forget("doc_draft:{$document->id}:{$userId}");

            $document->update([
                'draft_content' => null,
                'draft_base_version' => null,
                'draft_saved_at' => null,
                'draft_author_id' => null,
            ]);

            $document->touch();

            return $version;
        });

        ProjectActivity::record($projectId, $request->user()->id, 'document_version_saved', 'document', $id, "Saved version {$version->version_number} of the document '{$document->title}'");

        return $this->successResponse(
            $this->formatVersion($version->load(['author', 'citations.resource', 'citations.evidence'])),
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

        ProjectActivity::record($projectId, $request->user()->id, 'document_version_restored', 'document', $id, "Restored version {$versionNumber} of the document '{$document->title}'");

        return $this->successResponse(
            $this->formatVersion($newVersion->load(['author', 'citations.resource', 'citations.evidence'])),
            "Version {$versionNumber} restored as revision {$newVersion->version_number}.",
            201
        );
    }

    /**
     * Helper to format a citation and flag missing components (C-18).
     */
    public function cite(Request $request, int $projectId, int $id): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $document = Document::where('project_id', $projectId)->find($id);
        if (!$document) {
            return $this->errorResponse('Document not found.', 'NOT_FOUND', 404);
        }

        $validated = $request->validate([
            'evidence_id' => 'required|integer|exists:evidence_items,id',
            'mode' => 'nullable|string|in:direct_quotation,paraphrase,reference',
            'style' => 'nullable|string|max:50',
        ]);

        $evidence = \App\Models\EvidenceItem::where('project_id', $projectId)
            ->with('resource')
            ->find($validated['evidence_id']);

        if (!$evidence) {
            return $this->errorResponse('Evidence item does not belong to this project.', 'NOT_FOUND', 404);
        }

        $resource = $evidence->resource;

        $missing = [];
        $locator = $evidence->locator ?? '';
        if (empty($locator)) {
            $missing[] = 'page_or_hadith_number';
        }

        $resTitle = $resource?->title ?? 'Unknown Source';
        $resAuthor = $resource?->author ?? ($resource?->source_metadata['author'] ?? null);
        if (!$resAuthor) {
            $missing[] = 'author';
        }
        $resYear = $resource?->source_metadata['publication_year'] ?? null;
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
            $this->formatDocument($document->fresh(['latestVersion.author', 'findings'])),
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
            $this->formatDocument($document->fresh(['latestVersion.author', 'findings'])),
            'Finding unlinked from document.'
        );
    }

    /**
     * List version history / changelog scoped to project (C-18).
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
            ->with(['author', 'citations.resource', 'citations.evidence'])
            ->orderBy('version_number', 'asc')
            ->get();

        return $this->successResponse(
            $versions->map(fn($v) => $this->formatVersion($v))->values()->all()
        );
    }

    /**
     * Get a specific historical revision by version number scoped to project (C-18).
     */
    public function getVersion(Request $request, int $projectId, int $id, int $versionNumber): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $document = Document::where('project_id', $projectId)->find($id);
        if (!$document) {
            return $this->errorResponse('Document not found.', 'NOT_FOUND', 404);
        }

        $version = DocumentVersion::where('document_id', $id)
            ->where('version_number', $versionNumber)
            ->with(['author', 'citations.resource', 'citations.evidence'])
            ->first();

        if (!$version) {
            return $this->errorResponse('Document version not found.', 'NOT_FOUND', 404);
        }

        return $this->successResponse($this->formatVersion($version));
    }
}

