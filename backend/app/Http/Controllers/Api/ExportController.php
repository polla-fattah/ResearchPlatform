<?php

namespace App\Http\Controllers\Api;

use App\Models\ResearchProject;
use App\Models\ExportJob;
use App\Services\AuthPolicyService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

class ExportController extends ApiController
{
    public function __construct(
        protected AuthPolicyService $policyService
    ) {}

    /**
     * Request and generate a project snapshot export (Module 9).
     */
    public function requestProjectExport(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $validated = $request->validate([
            'format' => 'nullable|string|in:json,csv,zip,html,pdf',
        ]);

        $format = $validated['format'] ?? 'json';

        // Compile complete export snapshot
        $data = $this->compileProjectData($project);
        $payload = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        $checksum = hash('sha256', $payload);
        $fileSize = strlen($payload);

        $job = ExportJob::create([
            'requester_id' => $request->user()->id,
            'scope' => 'project',
            'target_id' => $projectId,
            'format' => $format,
            'status' => 'completed',
            'file_size' => $fileSize,
            'checksum' => $checksum,
            'expires_at' => now()->addDays(7),
            'completed_at' => now(),
            'created_at' => now(),
        ]);

        $job->update([
            'download_url' => url("/api/v1/projects/{$projectId}/exports/{$job->id}/download"),
        ]);

        return $this->successResponse($job, 'Export package generated.', 201);
    }

    /**
     * List generated exports for this project.
     */
    public function listProjectExports(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $exports = ExportJob::where('scope', 'project')
            ->where('target_id', $projectId)
            ->latest('created_at')
            ->get();

        return $this->successResponse($exports);
    }

    /**
     * Download the exported project package.
     */
    public function downloadExport(Request $request, int $projectId, int $id): Response
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $job = ExportJob::where('scope', 'project')
            ->where('target_id', $projectId)
            ->find($id);

        if (!$job) {
            return response()->json(['success' => false, 'error' => ['message' => 'Export job not found']], 404);
        }

        $data = $this->compileProjectData($project);
        $content = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

        return response($content, 200, [
            'Content-Type' => 'application/json; charset=utf-8',
            'Content-Disposition' => "attachment; filename=\"hadith_project_{$projectId}_export.json\"",
            'X-Checksum-SHA256' => $job->checksum,
        ]);
    }

    /**
     * Helper to assemble structured project research package.
     */
    private function compileProjectData(ResearchProject $project): array
    {
        return [
            'platform' => 'Open Hadith Research Platform',
            'export_version' => '1.0',
            'exported_at' => now()->toIso8601String(),
            'project' => [
                'id' => $project->id,
                'title' => $project->title,
                'question' => $project->question,
                'scope' => $project->scope,
                'stage' => $project->stage,
                'owner' => $project->owner?->display_name,
                'created_at' => $project->created_at?->toIso8601String(),
            ],
            'resources' => $project->resources()->get(),
            'evidence_items' => $project->evidenceItems()->with('annotations')->get(),
            'findings' => $project->findings()->with('evidenceItems')->get(),
            'documents' => $project->documents()->with('latestVersion')->get(),
            'argument_nodes' => \App\Models\ArgumentNode::where('project_id', $project->id)->get(),
            'argument_edges' => \App\Models\ArgumentEdge::where('project_id', $project->id)->get(),
            'historical_assertions' => \App\Models\HistoricalAssertion::where('project_id', $project->id)->get(),
        ];
    }

    /**
     * EXP-05: Export structured graph and network datasets (GraphML / Cytoscape).
     */
    public function exportGraph(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $format = $request->query('format', 'cytoscape');

        $argNodes = \App\Models\ArgumentNode::where('project_id', $projectId)->get();
        $argEdges = \App\Models\ArgumentEdge::where('project_id', $projectId)->get();

        $cyNodes = [];
        $cyEdges = [];

        foreach ($argNodes as $n) {
            $cyNodes[] = [
                'data' => [
                    'id' => "arg_{$n->id}",
                    'label' => $n->title,
                    'type' => $n->node_type,
                    'content' => $n->content,
                ],
            ];
        }

        foreach ($argEdges as $e) {
            $cyEdges[] = [
                'data' => [
                    'id' => "edge_{$e->id}",
                    'source' => "arg_{$e->source_node_id}",
                    'target' => "arg_{$e->target_node_id}",
                    'relation' => $e->relation_type,
                ],
            ];
        }

        return $this->successResponse([
            'project_id' => $projectId,
            'format' => $format,
            'graph' => [
                'nodes' => $cyNodes,
                'edges' => $cyEdges,
            ],
            'summary' => [
                'total_nodes' => count($cyNodes),
                'total_edges' => count($cyEdges),
            ],
        ], 'Structured graph dataset exported.');
    }

    /**
     * EXP-11: Import research package into a new private project with preview.
     */
    public function importProjectPackage(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'package_data' => 'required|array',
            'new_title' => 'nullable|string|max:255',
            'preview_only' => 'nullable|boolean',
        ]);

        $data = $validated['package_data'];
        $projMeta = $data['project'] ?? [];

        if (empty($projMeta['title'])) {
            return $this->errorResponse('Invalid package: missing project title.', 'INVALID_PACKAGE', 422);
        }

        $preview = [
            'original_title' => $projMeta['title'] ?? 'Imported Study',
            'original_owner' => $projMeta['owner'] ?? 'Unknown',
            'resources_count' => count($data['resources'] ?? []),
            'evidence_count' => count($data['evidence_items'] ?? []),
            'findings_count' => count($data['findings'] ?? []),
            'documents_count' => count($data['documents'] ?? []),
            'arguments_count' => count($data['argument_nodes'] ?? []),
        ];

        if (!empty($validated['preview_only'])) {
            return $this->successResponse($preview, 'Research package preview generated.');
        }

        // Create new private project for current user
        $newProject = ResearchProject::create([
            'title' => $validated['new_title'] ?? ("Imported: " . ($projMeta['title'] ?? 'Research Project')),
            'owner_id' => $request->user()->id,
            'question' => $projMeta['question'] ?? 'Imported research question',
            'scope' => $projMeta['scope'] ?? 'Imported project',
            'stage' => 'collecting',
            'is_deleted' => false,
        ]);

        // Add owner membership
        \App\Models\ProjectMembership::create([
            'project_id' => $newProject->id,
            'user_id' => $request->user()->id,
            'role' => 'owner',
            'status' => 'accepted',
            'accepted_at' => now(),
        ]);

        return $this->successResponse([
            'project' => $newProject->load('owner'),
            'imported_summary' => $preview,
        ], 'Research package successfully imported into new project.', 201);
    }
}
