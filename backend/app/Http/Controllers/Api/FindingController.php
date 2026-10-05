<?php

namespace App\Http\Controllers\Api;

use App\Models\ResearchProject;
use App\Models\Finding;
use App\Models\EvidenceItem;
use App\Services\AuthPolicyService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class FindingController extends ApiController
{
    public function __construct(
        protected AuthPolicyService $policyService
    ) {}

    /**
     * List findings and claims in a project workspace (Module 6).
     */
    public function index(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $query = Finding::where('project_id', $projectId)
            ->with(['evidenceItems.resource']);

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('q')) {
            $term = $request->input('q');
            $query->where(function ($q) use ($term) {
                $q->where('question', 'ILIKE', "%{$term}%")
                  ->orWhere('claim', 'ILIKE', "%{$term}%")
                  ->orWhere('reasoning', 'ILIKE', "%{$term}%");
            });
        }

        $perPage = min((int) ($request->input('per_page', 20)), 100);
        $findings = $query->latest('updated_at')->paginate($perPage);

        return $this->paginatedResponse($findings);
    }

    /**
     * Create a new research finding with optional evidence links.
     */
    public function store(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $validated = $request->validate([
            'question' => 'required|string',
            'claim' => 'required|string',
            'reasoning' => 'required|string',
            'limitations' => 'nullable|string',
            'status' => 'nullable|string|in:provisional,supported,inconclusive,disputed',
            'evidence_links' => 'nullable|array',
            'evidence_links.*.evidence_id' => 'required_with:evidence_links|integer|exists:evidence_items,id',
            'evidence_links.*.relation_type' => 'required_with:evidence_links|string|in:supporting,opposing,contextual,unresolved',
            'evidence_links.*.interpretation' => 'nullable|string',
        ]);

        $finding = DB::transaction(function () use ($projectId, $validated) {
            $finding = Finding::create([
                'project_id' => $projectId,
                'question' => $validated['question'],
                'claim' => $validated['claim'],
                'reasoning' => $validated['reasoning'],
                'limitations' => $validated['limitations'] ?? null,
                'status' => $validated['status'] ?? 'provisional',
            ]);

            if (!empty($validated['evidence_links'])) {
                foreach ($validated['evidence_links'] as $link) {
                    $finding->evidenceItems()->attach($link['evidence_id'], [
                        'relation_type' => $link['relation_type'],
                        'interpretation' => $link['interpretation'] ?? null,
                        'created_at' => now(),
                    ]);
                }
            }

            return $finding;
        });

        return $this->successResponse(
            $finding->load('evidenceItems.resource'),
            'Research finding recorded.',
            201
        );
    }

    /**
     * View detailed finding with linked evidence items.
     */
    public function show(Request $request, int $projectId, int $id): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $finding = Finding::where('project_id', $projectId)
            ->with(['evidenceItems.resource', 'evidenceItems.collector', 'documents'])
            ->find($id);

        if (!$finding) {
            return $this->errorResponse('Finding not found.', 'NOT_FOUND', 404);
        }

        return $this->successResponse($finding);
    }

    /**
     * Update finding details.
     */
    public function update(Request $request, int $projectId, int $id): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $finding = Finding::where('project_id', $projectId)->find($id);
        if (!$finding) {
            return $this->errorResponse('Finding not found.', 'NOT_FOUND', 404);
        }

        // DEF-8 Optimistic concurrency check
        $expectedVersion = $request->input('expected_version') ?? $request->header('If-Match');
        if ($expectedVersion !== null) {
            $expectedVersionClean = trim($expectedVersion, '"');
            if (is_numeric($expectedVersionClean) && (int)$expectedVersionClean !== (int)$finding->version) {
                return $this->errorResponse(
                    'Finding version conflict. Finding has been updated by another action.',
                    'CONFLICT',
                    409,
                    [
                        'current_version' => $finding->version,
                        'updated_at' => $finding->updated_at?->toIso8601String(),
                    ]
                );
            }
        }

        $validated = $request->validate([
            'question' => 'sometimes|required|string',
            'claim' => 'sometimes|required|string',
            'reasoning' => 'sometimes|required|string',
            'limitations' => 'nullable|string',
            'status' => 'nullable|string|in:provisional,supported,inconclusive,disputed',
            'contributors' => 'nullable|array',
            'expected_version' => 'nullable|integer',
        ]);

        unset($validated['expected_version']);
        $validated['version'] = ($finding->version ?? 1) + 1;

        $finding->update($validated);

        return $this->successResponse($finding->fresh(['evidenceItems.resource', 'documents']), 'Finding updated.');
    }

    /**
     * Delete a finding.
     */
    public function destroy(Request $request, int $projectId, int $id): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $finding = Finding::where('project_id', $projectId)->find($id);
        if (!$finding) {
            return $this->errorResponse('Finding not found.', 'NOT_FOUND', 404);
        }

        $finding->delete();

        return $this->successResponse(null, 'Finding deleted.');
    }

    /**
     * Link an evidence item to this finding.
     */
    public function linkEvidence(Request $request, int $projectId, int $id): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $finding = Finding::where('project_id', $projectId)->find($id);
        if (!$finding) {
            return $this->errorResponse('Finding not found.', 'NOT_FOUND', 404);
        }

        $validated = $request->validate([
            'evidence_id' => 'required|integer|exists:evidence_items,id',
            'relation_type' => 'required|string|in:supporting,opposing,contextual,unresolved',
            'interpretation' => 'nullable|string',
        ]);

        $finding->evidenceItems()->syncWithoutDetaching([
            $validated['evidence_id'] => [
                'relation_type' => $validated['relation_type'],
                'interpretation' => $validated['interpretation'] ?? null,
                'created_at' => now(),
            ]
        ]);

        return $this->successResponse($finding->load('evidenceItems.resource'), 'Evidence linked to finding.');
    }

    /**
     * Unlink evidence item from this finding.
     */
    public function unlinkEvidence(Request $request, int $projectId, int $id, int $evidenceId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $finding = Finding::where('project_id', $projectId)->find($id);
        if (!$finding) {
            return $this->errorResponse('Finding not found.', 'NOT_FOUND', 404);
        }

        $finding->evidenceItems()->detach($evidenceId);

        return $this->successResponse(null, 'Evidence unlinked from finding.');
    }
}
