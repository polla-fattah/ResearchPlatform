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
            ->with(['latestVersion.author', 'latestVersion.citations.resource'])
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

        return $this->successResponse($document->fresh('latestVersion'), 'Document metadata updated.');
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

        $validated = $request->validate([
            'content' => 'required|string',
            'change_summary' => 'nullable|string',
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
