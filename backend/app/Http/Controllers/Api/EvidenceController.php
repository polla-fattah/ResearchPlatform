<?php

namespace App\Http\Controllers\Api;

use App\Models\ResearchProject;
use App\Models\EvidenceItem;
use App\Models\Annotation;
use App\Models\Resource;
use App\Services\AuthPolicyService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class EvidenceController extends ApiController
{
    public function __construct(
        protected AuthPolicyService $policyService
    ) {}

    /**
     * List evidence items in a project workspace (Module 5).
     */
    public function index(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $query = EvidenceItem::where('project_id', $projectId)
            ->with(['resource', 'collector']);

        if ($request->filled('state')) {
            $query->where('state', $request->input('state'));
        }

        if ($request->filled('resource_id')) {
            $query->where('resource_id', $request->input('resource_id'));
        }

        if ($request->filled('q')) {
            $term = $request->input('q');
            $query->where(function ($q) use ($term) {
                $q->where('captured_text', 'ILIKE', "%{$term}%")
                  ->orWhere('locator', 'ILIKE', "%{$term}%")
                  ->orWhere('exclusion_reason', 'ILIKE', "%{$term}%");
            });
        }

        $perPage = min((int) ($request->input('per_page', 20)), 100);
        $items = $query->latest('updated_at')->paginate($perPage);

        return $this->paginatedResponse($items);
    }

    /**
     * Add an evidence item to the project workspace.
     */
    public function store(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'create_evidence', $project);

        $validated = $request->validate([
            'resource_id' => 'required|integer|exists:resources,id',
            'captured_text' => 'required|string|min:3',
            'locator' => 'nullable|string|max:255',
            'source_version' => 'nullable|string|max:50',
            'state' => 'nullable|string|in:candidate,included,reviewed,excluded,unresolved',
            'exclusion_reason' => 'nullable|string',
        ]);

        $contentHash = hash('sha256', trim($validated['captured_text']));

        $item = EvidenceItem::create([
            'project_id' => $projectId,
            'resource_id' => $validated['resource_id'],
            'captured_text' => $validated['captured_text'],
            'locator' => $validated['locator'] ?? null,
            'source_version' => $validated['source_version'] ?? '1.0',
            'content_hash' => $contentHash,
            'state' => $validated['state'] ?? 'candidate',
            'exclusion_reason' => $validated['exclusion_reason'] ?? null,
            'collector_id' => $request->user()->id,
        ]);

        // Auto-link resource to project bibliography if not yet linked
        $project->resources()->syncWithoutDetaching([
            $validated['resource_id'] => [
                'added_by' => $request->user()->id,
                'inclusion_rationale' => 'Referenced in evidence item #' . $item->id,
            ]
        ]);

        return $this->successResponse(
            $item->load(['resource', 'collector']),
            'Evidence item recorded successfully.',
            201
        );
    }

    /**
     * Show single evidence item with annotations and links.
     */
    public function show(Request $request, int $projectId, int $id): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $item = EvidenceItem::where('project_id', $projectId)
            ->with(['resource', 'collector', 'annotations.author', 'findings'])
            ->find($id);

        if (!$item) {
            return $this->errorResponse('Evidence item not found in this project.', 'NOT_FOUND', 404);
        }

        return $this->successResponse($item);
    }

    /**
     * Update evidence item attributes or state.
     */
    public function update(Request $request, int $projectId, int $id): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $item = EvidenceItem::where('project_id', $projectId)->find($id);
        if (!$item) {
            return $this->errorResponse('Evidence item not found.', 'NOT_FOUND', 404);
        }

        $validated = $request->validate([
            'captured_text' => 'sometimes|required|string|min:3',
            'locator' => 'nullable|string|max:255',
            'state' => 'nullable|string|in:candidate,included,reviewed,excluded,unresolved',
            'exclusion_reason' => 'nullable|string',
        ]);

        if (isset($validated['captured_text'])) {
            $validated['content_hash'] = hash('sha256', trim($validated['captured_text']));
        }

        $item->update($validated);

        return $this->successResponse($item->fresh(['resource', 'collector']), 'Evidence item updated.');
    }

    /**
     * Delete an evidence item.
     */
    public function destroy(Request $request, int $projectId, int $id): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $item = EvidenceItem::where('project_id', $projectId)->find($id);
        if (!$item) {
            return $this->errorResponse('Evidence item not found.', 'NOT_FOUND', 404);
        }

        $item->delete();

        return $this->successResponse(null, 'Evidence item deleted.');
    }

    /**
     * Add annotation to an evidence item.
     */
    public function addAnnotation(Request $request, int $projectId, int $id): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'comment', $project);

        $item = EvidenceItem::where('project_id', $projectId)->find($id);
        if (!$item) {
            return $this->errorResponse('Evidence item not found.', 'NOT_FOUND', 404);
        }

        $validated = $request->validate([
            'annotation_kind' => 'required|string|in:source_quotation,interpretation,scholarly_judgment,machine_suggestion',
            'body' => 'required|string',
            'span_start' => 'nullable|integer',
            'span_end' => 'nullable|integer',
            'visibility' => 'nullable|string|in:private,project_shared',
        ]);

        $annotation = Annotation::create([
            'author_id' => $request->user()->id,
            'target_type' => 'evidence',
            'target_id' => $item->id,
            'annotation_kind' => $validated['annotation_kind'],
            'body' => $validated['body'],
            'span_start' => $validated['span_start'] ?? null,
            'span_end' => $validated['span_end'] ?? null,
            'visibility' => $validated['visibility'] ?? 'project_shared',
        ]);

        return $this->successResponse($annotation->load('author'), 'Annotation created.', 201);
    }

    /**
     * List resources attached to the project workspace.
     */
    public function listResources(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $perPage = min((int) ($request->input('per_page', 20)), 100);
        $resources = $project->resources()->paginate($perPage);

        return $this->paginatedResponse($resources);
    }

    /**
     * Attach a resource to the project bibliography.
     */
    public function attachResource(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $validated = $request->validate([
            'resource_id' => 'required|integer|exists:resources,id',
            'inclusion_rationale' => 'nullable|string',
            'tags' => 'nullable|array',
        ]);

        $project->resources()->syncWithoutDetaching([
            $validated['resource_id'] => [
                'added_by' => $request->user()->id,
                'inclusion_rationale' => $validated['inclusion_rationale'] ?? null,
                'tags' => json_encode($validated['tags'] ?? []),
            ]
        ]);

        return $this->successResponse(null, 'Resource attached to project workspace.', 201);
    }

    /**
     * Detach a resource from the project bibliography.
     */
    public function detachResource(Request $request, int $projectId, int $resourceId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $project->resources()->detach($resourceId);

        return $this->successResponse(null, 'Resource detached from project workspace.');
    }
}
