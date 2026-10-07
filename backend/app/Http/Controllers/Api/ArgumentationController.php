<?php

namespace App\Http\Controllers\Api;

use App\Models\ArgumentEdge;
use App\Models\ArgumentNode;
use App\Models\ResearchProject;
use App\Services\AuthPolicyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ArgumentationController extends ApiController
{
    public function __construct(
        protected AuthPolicyService $policyService
    ) {}

    public function getGraph(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        // A removed point is kept (soft-deleted); it is listed only when asked for, so its history can be read.
        $nodeQuery = ArgumentNode::where('project_id', $projectId)
            ->with(['evidence', 'finding', 'creator'])
            ->orderBy('order_index');
        if ($request->boolean('include_removed')) {
            $nodeQuery->withTrashed();
        }
        $nodes = $nodeQuery->get();

        // A relation is shown only while both its points are.
        $liveIds = $nodes->whereNull('deleted_at')->pluck('id')->all();
        $edges = ArgumentEdge::where('project_id', $projectId)
            ->whereIn('source_node_id', $liveIds)
            ->whereIn('target_node_id', $liveIds)
            ->get();

        // Build Cytoscape compatible structure
        $cyElements = [
            'nodes' => [],
            'edges' => [],
        ];

        foreach ($nodes as $node) {
            $cyElements['nodes'][] = [
                'data' => [
                    'id' => (string)$node->id,
                    'label' => $node->title,
                    'type' => $node->node_type,
                    'content' => $node->content,
                    'evidence_id' => $node->evidence_id,
                    'finding_id' => $node->finding_id,
                ],
            ];
        }

        foreach ($edges as $edge) {
            $cyElements['edges'][] = [
                'data' => [
                    'id' => "e_{$edge->id}",
                    'source' => (string)$edge->source_node_id,
                    'target' => (string)$edge->target_node_id,
                    'relation' => $edge->relation_type,
                    'notes' => $edge->notes,
                ],
            ];
        }

        return $this->successResponse([
            'nodes' => $nodes,
            'edges' => $edges,
            'cytoscape' => $cyElements,
            'summary' => [
                'total_nodes' => count($nodes),
                'total_relations' => count($edges),
            ],
        ], 'Argumentation graph retrieved.');
    }

    public function createNode(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $validated = $request->validate([
            'node_type' => 'required|string|in:premise,claim,objection,reply,qualification,alternative_conclusion',
            'title' => 'required|string|max:255',
            'content' => 'required|string',
            'evidence_id' => ['nullable', 'integer', Rule::exists('evidence_items', 'id')->where('project_id', $projectId)],
            'finding_id' => ['nullable', 'integer', Rule::exists('findings', 'id')->where('project_id', $projectId)],
            'order_index' => 'nullable|integer',
        ]);

        $node = ArgumentNode::create([
            'project_id' => $projectId,
            'node_type' => $validated['node_type'],
            'title' => $validated['title'],
            'content' => $validated['content'],
            'evidence_id' => $validated['evidence_id'] ?? null,
            'finding_id' => $validated['finding_id'] ?? null,
            'order_index' => $validated['order_index'] ?? 0,
            'created_by' => $request->user()->id,
        ]);

        return $this->successResponse($node->load(['evidence', 'finding']), 'Argument node created.', 201);
    }

    public function updateNode(Request $request, int $projectId, int $nodeId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $node = ArgumentNode::where('project_id', $projectId)->findOrFail($nodeId);

        $validated = $request->validate([
            'node_type' => 'nullable|string|in:premise,claim,objection,reply,qualification,alternative_conclusion',
            'title' => 'nullable|string|max:255',
            'content' => 'nullable|string',
            'evidence_id' => ['nullable', 'integer', Rule::exists('evidence_items', 'id')->where('project_id', $projectId)],
            'finding_id' => ['nullable', 'integer', Rule::exists('findings', 'id')->where('project_id', $projectId)],
            'order_index' => 'nullable|integer',
        ]);

        // A link to evidence or a finding can be removed again by sending null for it; the text fields cannot be emptied.
        $changes = array_filter($validated, fn($val) => !is_null($val));
        foreach (['evidence_id', 'finding_id'] as $link) {
            if ($request->exists($link) && $request->input($link) === null) {
                $changes[$link] = null;
            }
        }
        $node->update($changes);

        return $this->successResponse($node->fresh(['evidence', 'finding']), 'Argument node updated.');
    }

    public function deleteNode(Request $request, int $projectId, int $nodeId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $node = ArgumentNode::where('project_id', $projectId)->findOrFail($nodeId);
        $node->delete();

        return $this->successResponse(null, 'Argument node removed.');
    }

    public function createEdge(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $validated = $request->validate([
            // Both points must be points of THIS project (and not removed): a number from another project is "not found".
            'source_node_id' => ['required', 'integer', Rule::exists('argument_nodes', 'id')->where('project_id', $projectId)->whereNull('deleted_at')],
            'target_node_id' => ['required', 'integer', Rule::exists('argument_nodes', 'id')->where('project_id', $projectId)->whereNull('deleted_at')],
            'relation_type' => 'required|string|in:supports,refutes,qualifies,replies_to,alternative_to',
            'notes' => 'nullable|string',
        ]);

        if ($validated['source_node_id'] === $validated['target_node_id']) {
            return $this->errorResponse('Self-referencing argument relations are invalid.', 'CYCLE_ERROR', 422);
        }

        $duplicate = ArgumentEdge::where('project_id', $projectId)
            ->where('source_node_id', $validated['source_node_id'])
            ->where('target_node_id', $validated['target_node_id'])
            ->where('relation_type', $validated['relation_type'])
            ->exists();
        if ($duplicate) {
            return $this->errorResponse('This relation already exists.', 'DUPLICATE_RELATION', 422);
        }

        // A new relation source -> target closes a loop when the source can already be reached from the target.
        if ($this->reaches($projectId, (int) $validated['target_node_id'], (int) $validated['source_node_id'])) {
            return $this->errorResponse('This relation would close a loop in the argument.', 'CYCLE_ERROR', 422);
        }

        $edge = ArgumentEdge::create([
            'project_id' => $projectId,
            'source_node_id' => $validated['source_node_id'],
            'target_node_id' => $validated['target_node_id'],
            'relation_type' => $validated['relation_type'],
            'notes' => $validated['notes'] ?? null,
            'created_at' => now(),
        ]);

        return $this->successResponse($edge->load(['sourceNode', 'targetNode']), 'Argument relation created.', 201);
    }

    public function deleteEdge(Request $request, int $projectId, int $edgeId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $edge = ArgumentEdge::where('project_id', $projectId)->findOrFail($edgeId);
        $edge->delete();

        return $this->successResponse(null, 'Argument relation removed.');
    }

    /** Whether `$to` can be reached from `$from` by following relations (source -> target) within the project. */
    private function reaches(int $projectId, int $from, int $to): bool
    {
        $next = ArgumentEdge::where('project_id', $projectId)->get(['source_node_id', 'target_node_id'])
            ->groupBy('source_node_id')
            ->map(fn($edges) => $edges->pluck('target_node_id')->all());

        $seen = [];
        $stack = [$from];
        while ($stack) {
            $node = array_pop($stack);
            if ($node === $to) {
                return true;
            }
            if (isset($seen[$node])) {
                continue;
            }
            $seen[$node] = true;
            foreach ($next[$node] ?? [] as $target) {
                $stack[] = (int) $target;
            }
        }
        return false;
    }
}
