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
            ->with(['resource', 'collector:id,display_name']);

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
     * Show single evidence item with annotations and links (DEF-4: private annotations filtered).
     */
    public function show(Request $request, int $projectId, int $id): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $userId = $request->user()?->id;
        $item = EvidenceItem::where('project_id', $projectId)
            ->with([
                'resource',
                'collector:id,display_name',
                'annotations' => function ($q) use ($userId) {
                    $q->where(function ($sub) use ($userId) {
                        $sub->where('visibility', '!=', 'private');
                        if ($userId) {
                            $sub->orWhere('author_id', $userId);
                        }
                    })->with('author:id,display_name');
                },
                'findings'
            ])
            ->find($id);

        if (!$item) {
            return $this->errorResponse('Evidence item not found in this project.', 'NOT_FOUND', 404);
        }

        return $this->successResponse($item);
    }

    /**
     * Update evidence item attributes or state (records state change to activity).
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
            'state_reason' => 'nullable|string',
        ]);

        if (isset($validated['state']) && in_array($validated['state'], ['excluded', 'unresolved'])) {
            if (empty($validated['state_reason']) && empty($validated['exclusion_reason'])) {
                return $this->errorResponse(
                    'A reason is required when transitioning evidence to excluded or unresolved state.',
                    'STATE_REASON_REQUIRED',
                    422
                );
            }
        }

        if (isset($validated['captured_text'])) {
            $validated['content_hash'] = hash('sha256', trim($validated['captured_text']));
        }

        $oldState = $item->state;
        if (isset($validated['state_reason']) && !isset($validated['exclusion_reason'])) {
            $validated['exclusion_reason'] = $validated['state_reason'];
        }

        $item->update($validated);

        if (!empty($validated['state']) && $validated['state'] !== $oldState) {
            $reason = $validated['exclusion_reason'] ?? ($validated['state_reason'] ?? 'No reason provided');
            \App\Models\ProjectActivity::create([
                'project_id' => $projectId,
                'actor_id' => $request->user()->id,
                'action' => 'evidence_state_changed',
                'object_type' => 'evidence',
                'object_id' => $item->id,
                'summary' => "Changed state of EV-{$item->id}: {$oldState} → {$validated['state']} (reason: {$reason})",
                'created_at' => now(),
            ]);
        }

        return $this->successResponse($item->fresh(['resource', 'collector']), 'Evidence item updated.');
    }

    /**
     * Delete an evidence item (checks dependencies; returns 409 HAS_DEPENDENCIES unless confirm=true).
     */
    public function destroy(Request $request, int $projectId, int $id): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $item = EvidenceItem::where('project_id', $projectId)->find($id);
        if (!$item) {
            return $this->errorResponse('Evidence item not found.', 'NOT_FOUND', 404);
        }

        $findingsCount = $item->findings()->count();
        $citationsCount = \App\Models\Citation::where('evidence_id', $id)->count();

        if (($findingsCount > 0 || $citationsCount > 0) && !$request->boolean('confirm')) {
            return $this->errorResponse(
                'Cannot delete evidence item because it has dependent research objects.',
                'HAS_DEPENDENCIES',
                409,
                [
                    'findings_count' => $findingsCount,
                    'citations_count' => $citationsCount,
                    'dependent_findings' => $item->findings()->select(['findings.id', 'findings.claim'])->get(),
                ]
            );
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
            'attributed_to' => 'nullable|string|max:255',
            'source_locator' => 'nullable|string|max:255',
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

        return $this->successResponse($annotation->load('author:id,display_name'), 'Annotation created.', 201);
    }

    /**
     * List annotations for an evidence item (DEF-4: private filtered to author only).
     */
    public function listAnnotations(Request $request, int $projectId, int $id): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $item = EvidenceItem::where('project_id', $projectId)->find($id);
        if (!$item) {
            return $this->errorResponse('Evidence item not found.', 'NOT_FOUND', 404);
        }

        $userId = $request->user()->id;
        $annotations = Annotation::where('target_type', 'evidence')
            ->where('target_id', $id)
            ->where(function ($q) use ($userId) {
                $q->where('visibility', '!=', 'private')
                  ->orWhere('author_id', $userId);
            })
            ->with('author:id,display_name')
            ->latest('created_at')
            ->get();

        return $this->successResponse($annotations);
    }

    /**
     * Update/promote an annotation (EVI-04: promotion private -> project_shared).
     */
    public function updateAnnotation(Request $request, int $projectId, int $id, int $annotationId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'comment', $project);

        $annotation = Annotation::where('target_type', 'evidence')
            ->where('target_id', $id)
            ->find($annotationId);

        if (!$annotation) {
            return $this->errorResponse('Annotation not found.', 'NOT_FOUND', 404);
        }

        // Only author or project owner can update
        if ($annotation->author_id !== $request->user()->id && $project->owner_id !== $request->user()->id) {
            return $this->errorResponse('Only the author can edit this annotation.', 'FORBIDDEN', 403);
        }

        $validated = $request->validate([
            'body' => 'sometimes|required|string',
            'visibility' => 'nullable|string|in:private,project_shared',
            'annotation_kind' => 'nullable|string|in:source_quotation,interpretation,scholarly_judgment,machine_suggestion',
        ]);

        $annotation->update($validated);

        return $this->successResponse($annotation->fresh('author:id,display_name'), 'Annotation updated.');
    }

    /**
     * Delete an annotation.
     */
    public function deleteAnnotation(Request $request, int $projectId, int $id, int $annotationId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'comment', $project);

        $annotation = Annotation::where('target_type', 'evidence')
            ->where('target_id', $id)
            ->find($annotationId);

        if (!$annotation) {
            return $this->errorResponse('Annotation not found.', 'NOT_FOUND', 404);
        }

        if ($annotation->author_id !== $request->user()->id && $project->owner_id !== $request->user()->id) {
            return $this->errorResponse('Only the author or project owner can delete this annotation.', 'FORBIDDEN', 403);
        }

        $annotation->delete();

        return $this->successResponse(null, 'Annotation deleted.');
    }

    /**
     * Get evidence state change history (API-7).
     */
    public function getHistory(Request $request, int $projectId, int $id): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $item = EvidenceItem::where('project_id', $projectId)->find($id);
        if (!$item) {
            return $this->errorResponse('Evidence item not found.', 'NOT_FOUND', 404);
        }

        $activities = \App\Models\ProjectActivity::where('project_id', $projectId)
            ->where('object_type', 'evidence')
            ->where('object_id', $id)
            ->with('actor:id,display_name')
            ->latest('created_at')
            ->get();

        return $this->successResponse([
            'evidence_id' => $id,
            'current_state' => $item->state,
            'created_at' => $item->created_at,
            'collector' => $item->collector?->display_name,
            'history' => $activities,
        ]);
    }

    /**
     * Get dependencies of an evidence item (API-7).
     */
    public function getDependencies(Request $request, int $projectId, int $id): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $item = EvidenceItem::where('project_id', $projectId)->find($id);
        if (!$item) {
            return $this->errorResponse('Evidence item not found.', 'NOT_FOUND', 404);
        }

        $findings = $item->findings()->select(['findings.id', 'findings.claim', 'findings.status'])->get();

        $citations = \App\Models\Citation::where('evidence_id', $id)
            ->with(['documentVersion.document'])
            ->get();

        $documents = [];
        foreach ($citations as $cit) {
            $doc = $cit->documentVersion?->document;
            if ($doc) {
                $documents[$doc->id] = [
                    'id' => $doc->id,
                    'title' => $doc->title,
                    'version_number' => $cit->documentVersion?->version_number,
                    'citation_type' => $cit->citation_type,
                ];
            }
        }

        return $this->successResponse([
            'evidence_id' => $id,
            'findings' => $findings,
            'documents' => array_values($documents),
            'total_dependencies' => count($findings) + count($documents),
        ]);
    }

    /**
     * Bulk add evidence items from search run or occurrences (SEA-08).
     */
    public function bulkAddEvidence(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $validated = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.captured_text' => 'required|string',
            'items.*.locator' => 'nullable|string|max:255',
            'items.*.resource_id' => 'required|integer|exists:resources,id',
            'run_id' => 'nullable|integer',
        ]);

        $results = [];
        foreach ($validated['items'] as $it) {
            $contentHash = hash('sha256', trim($it['captured_text']));
            $existing = EvidenceItem::where('project_id', $projectId)
                ->where('resource_id', $it['resource_id'])
                ->where('content_hash', $contentHash)
                ->first();

            if ($existing) {
                $results[] = [
                    'id' => $existing->id,
                    'outcome' => 'duplicate_skipped',
                    'resource_id' => $it['resource_id'],
                ];
                continue;
            }

            $created = EvidenceItem::create([
                'project_id' => $projectId,
                'resource_id' => $it['resource_id'],
                'captured_text' => $it['captured_text'],
                'locator' => $it['locator'] ?? null,
                'content_hash' => $contentHash,
                'state' => 'candidate',
                'collector_id' => $request->user()->id,
            ]);

            $results[] = [
                'id' => $created->id,
                'outcome' => 'added',
                'resource_id' => $it['resource_id'],
            ];
        }

        return $this->successResponse([
            'outcomes' => $results,
            'added_count' => count(array_filter($results, fn($r) => $r['outcome'] === 'added')),
            'skipped_count' => count(array_filter($results, fn($r) => $r['outcome'] === 'duplicate_skipped')),
        ], 'Bulk evidence processing complete.', 201);
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

        $isAttached = $project->resources()->where('resources.id', $validated['resource_id'])->exists();
        if ($isAttached) {
            return $this->successResponse([
                'already_attached' => true,
                'resource_id' => $validated['resource_id'],
            ], 'Resource is already attached to this project.', 200);
        }

        $project->resources()->syncWithoutDetaching([
            $validated['resource_id'] => [
                'added_by' => $request->user()->id,
                'inclusion_rationale' => $validated['inclusion_rationale'] ?? null,
                'tags' => json_encode($validated['tags'] ?? []),
            ]
        ]);

        return $this->successResponse([
            'already_attached' => false,
            'resource_id' => $validated['resource_id'],
        ], 'Resource attached to project workspace.', 201);
    }

    /**
     * Bulk attach resources to project bibliography (SEA-08).
     */
    public function bulkAddResources(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $validated = $request->validate([
            'resource_ids' => 'required|array|min:1',
            'resource_ids.*' => 'integer|exists:resources,id',
            'run_id' => 'nullable|integer',
        ]);

        $outcomes = [];
        foreach ($validated['resource_ids'] as $resId) {
            $alreadyAttached = $project->resources()->where('resources.id', $resId)->exists();
            if ($alreadyAttached) {
                $outcomes[] = ['resource_id' => $resId, 'outcome' => 'duplicate_skipped'];
            } else {
                $project->resources()->attach($resId, [
                    'added_by' => $request->user()->id,
                    'inclusion_rationale' => $validated['run_id'] ? "From search run {$validated['run_id']}" : 'Bulk added',
                    'tags' => json_encode([]),
                ]);
                $outcomes[] = ['resource_id' => $resId, 'outcome' => 'added'];
            }
        }

        return $this->successResponse([
            'outcomes' => $outcomes,
            'added_count' => count(array_filter($outcomes, fn($r) => $r['outcome'] === 'added')),
            'skipped_count' => count(array_filter($outcomes, fn($r) => $r['outcome'] === 'duplicate_skipped')),
        ], 'Bulk resource attachment complete.', 201);
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
