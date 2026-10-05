<?php

namespace App\Http\Controllers\Api;

use App\Models\ArgumentEdge;
use App\Models\ArgumentNode;
use App\Models\ResearchProject;
use App\Services\AuthPolicyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ArgumentationController extends ApiController
{
    public function __construct(
        protected AuthPolicyService $policyService
    ) {}

    public function getGraph(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $nodes = ArgumentNode::where('project_id', $projectId)
            ->with(['evidence', 'finding', 'creator'])
            ->orderBy('order_index')
            ->get();

        $edges = ArgumentEdge::where('project_id', $projectId)->get();

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
            'evidence_id' => 'nullable|integer|exists:evidence_items,id',
            'finding_id' => 'nullable|integer|exists:findings,id',
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
            'evidence_id' => 'nullable|integer|exists:evidence_items,id',
            'finding_id' => 'nullable|integer|exists:findings,id',
            'order_index' => 'nullable|integer',
        ]);

        $node->update(array_filter($validated, fn($val) => !is_null($val)));

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
            'source_node_id' => 'required|integer|exists:argument_nodes,id',
            'target_node_id' => 'required|integer|exists:argument_nodes,id',
            'relation_type' => 'required|string|in:supports,refutes,qualifies,replies_to,alternative_to',
            'notes' => 'nullable|string',
        ]);

        if ($validated['source_node_id'] === $validated['target_node_id']) {
            return $this->errorResponse('Self-referencing argument relations are invalid.', 'CYCLE_ERROR', 422);
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
}
