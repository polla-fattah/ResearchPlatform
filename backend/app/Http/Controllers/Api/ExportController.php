<?php

namespace App\Http\Controllers\Api;

use App\Models\ResearchProject;
use App\Models\ProjectResource;
use App\Models\EvidenceItem;
use App\Models\Document;
use App\Models\LibraryItem;
use App\Models\ExportJob;
use App\Services\AuthPolicyService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class ExportController extends ApiController
{
    public function __construct(
        protected AuthPolicyService $policyService
    ) {}

    /**
     * Account-wide export request supporting multiple scopes & formats (API-9 / EXP-01..10).
     */
    public function createExport(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->status !== 'approved' && !$user->is_admin) {
            return $this->errorResponse('Only approved researcher accounts can request data exports.', 'ACCOUNT_NOT_APPROVED', 403);
        }

        $validated = $request->validate([
            'scope' => 'required|string|in:document,resources,project,account',
            'ids' => 'nullable|array',
            'ids.*' => 'integer',
            'project_ids' => 'nullable|array',
            'project_ids.*' => 'integer|exists:research_projects,id',
            'formats' => 'nullable|array',
            'formats.*' => 'string|in:html,md,json,csv,bib,ris,pdf,zip,docx',
            'include_personal_library' => 'nullable|boolean',
        ]);

        $scope = $validated['scope'];
        $formats = $validated['formats'] ?? ['zip'];
        $format = $formats[0] ?? 'zip';

        // Check concurrent jobs quota (API-9)
        $runningJobs = ExportJob::where('requester_id', $user->id)
            ->whereIn('status', ['queued', 'running'])
            ->count();

        if ($runningJobs >= 2) {
            return $this->errorResponse('Concurrent export limit reached (2 maximum). Please wait for ongoing jobs to complete.', 'LIMIT_EXCEEDED', 429);
        }

        $projectIds = $validated['project_ids'] ?? [];
        if ($scope === 'project' && !empty($validated['ids'])) {
            $projectIds = array_merge($projectIds, $validated['ids']);
        }
        $projectIds = array_unique($projectIds);

        // Security check: verify caller has access to each specified project
        foreach ($projectIds as $pId) {
            $project = ResearchProject::where('is_deleted', false)->find($pId);
            if (!$project || !$this->policyService->canAccessProject($user, 'view', $project)) {
                return $this->errorResponse('Project not found or inaccessible.', 'NOT_FOUND', 404);
            }
        }

        if ($scope === 'account') {
            $projectIds = ResearchProject::where(function ($q) use ($user) {
                $q->where('owner_id', $user->id)
                  ->orWhereHas('memberships', fn($mq) => $mq->where('user_id', $user->id)->where('status', 'accepted'));
            })->where('is_deleted', false)->pluck('id')->all();
        }

        // Idempotency support
        $idempotencyKey = $request->header('Idempotency-Key');
        if ($idempotencyKey) {
            $cachedJobId = cache()->get("export_idempotency:{$user->id}:{$idempotencyKey}");
            if ($cachedJobId) {
                $existing = ExportJob::find($cachedJobId);
                if ($existing) {
                    return $this->successResponse([
                        'job_id' => $existing->id,
                        'export_job' => $existing,
                    ], 'Existing export job retrieved.', 200);
                }
            }
        }

        $targetId = !empty($projectIds) ? $projectIds[0] : ($validated['ids'][0] ?? null);

        $job = ExportJob::create([
            'requester_id' => $user->id,
            'scope' => $scope,
            'target_id' => $targetId,
            'format' => $format,
            'status' => 'queued',
            'progress' => 'Packaging objects...',
            'parts' => [],
            'exclusions' => [],
            'manifest' => null,
            'expires_at' => now()->addDays(7),
            'created_at' => now(),
        ]);

        if ($idempotencyKey) {
            cache()->put("export_idempotency:{$user->id}:{$idempotencyKey}", $job->id, now()->addHours(12));
        }

        // A DOCX request produces a real Word document (C-42), not the JSON archive.
        if ($format === 'docx') {
            $exportDir = storage_path('app/exports');
            if (!file_exists($exportDir)) {
                mkdir($exportDir, 0755, true);
            }
            $docxPath = $exportDir . DIRECTORY_SEPARATOR . "export_{$job->id}.docx";
            $lines = [];
            foreach ($projectIds as $pId) {
                $proj = ResearchProject::find($pId);
                if (!$proj) continue;
                $lines[] = ['heading', (string) $proj->title];
                if ($proj->question) $lines[] = ['text', (string) $proj->question];
                if ($proj->scope) $lines[] = ['text', (string) $proj->scope];
                foreach ($proj->findings()->get() as $f) {
                    $lines[] = ['heading2', (string) $f->claim];
                    if ($f->reasoning) $lines[] = ['text', (string) $f->reasoning];
                }
                foreach (Document::where('project_id', $pId)->with('latestVersion')->get() as $d) {
                    $lines[] = ['heading2', (string) $d->title];
                    $plain = trim(html_entity_decode(strip_tags((string) ($d->latestVersion?->content ?? ''))));
                    foreach (preg_split('/\R+/u', $plain) ?: [] as $para) {
                        if (trim($para) !== '') $lines[] = ['text', $para];
                    }
                }
            }
            $this->writeDocx($docxPath, $lines);
            $fileSize = filesize($docxPath);
            $checksum = hash_file('sha256', $docxPath);
            $manifest = [
                'job_id' => $job->id,
                'scope' => $scope,
                'format' => 'docx',
                'created_at' => now()->toIso8601String(),
                'requester' => ['id' => $user->id, 'display_name' => $user->display_name],
                'files' => ["export_{$job->id}_part_1.docx"],
                'rights_checked' => true,
            ];
            $job->update([
                'status' => 'completed',
                'progress' => 'Packaging completed',
                'file_size' => $fileSize,
                'checksum' => $checksum,
                'parts' => [[
                    'id' => 1,
                    'part_number' => 1,
                    'name' => "export_{$job->id}_part_1.docx",
                    'size' => $fileSize,
                    'size_bytes' => $fileSize,
                    'checksum' => $checksum,
                    'checksum_sha256' => $checksum,
                    'status' => 'ready',
                ]],
                'manifest' => $manifest,
            ]);

            return $this->successResponse([
                'job_id' => $job->id,
                'export_job' => $job->fresh(),
            ], 'Export job packaged successfully.', 201);
        }

        // Generate real ZIP archive on disk (C-7)
        $exportDir = storage_path('app/exports');
        if (!file_exists($exportDir)) {
            mkdir($exportDir, 0755, true);
        }

        $zipFilename = "export_{$job->id}.zip";
        $zipPath = $exportDir . DIRECTORY_SEPARATOR . $zipFilename;

        $zip = new \ZipArchive();
        if ($zip->open($zipPath, \ZipArchive::CREATE | \ZipArchive::OVERWRITE) === true) {
            $manifestFiles = [];

            // Add project data files
            foreach ($projectIds as $pId) {
                $proj = ResearchProject::find($pId);
                if (!$proj) continue;

                $evidenceItems = EvidenceItem::where('project_id', $pId)
                    ->with(['annotations' => function ($aq) use ($user) {
                        // DEF-4: only include public annotations or annotations authored by caller
                        $aq->where('visibility', 'public')->orWhere('author_id', $user->id);
                    }])
                    ->get();

                $resources = ProjectResource::where('project_id', $pId)->get();
                $documents = Document::where('project_id', $pId)->with('latestVersion')->get();

                $projPackage = [
                    'id' => $proj->id,
                    'title' => $proj->title,
                    'scope' => $proj->scope,
                    'stage' => $proj->stage,
                    'created_at' => $proj->created_at?->toIso8601String(),
                    'resources' => $resources,
                    'evidence_items' => $evidenceItems,
                    'documents' => $documents,
                ];

                $zip->addFromString("projects/project_{$pId}.json", json_encode($projPackage, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
                $manifestFiles[] = "projects/project_{$pId}.json";
            }

            // Include personal library if requested or scope is account
            if (!empty($validated['include_personal_library']) || $scope === 'account') {
                $libraryItems = LibraryItem::where('user_id', $user->id)->get();
                $zip->addFromString("library/library_items.json", json_encode($libraryItems, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
                $manifestFiles[] = "library/library_items.json";
            }

            // Manifest file
            $manifest = [
                'job_id' => $job->id,
                'scope' => $scope,
                'format' => $format,
                'created_at' => now()->toIso8601String(),
                'requester' => [
                    'id' => $user->id,
                    'display_name' => $user->display_name,
                ],
                'files' => $manifestFiles,
                'rights_checked' => true,
            ];

            $zip->addFromString("manifest.json", json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            $zip->close();

            $fileSize = file_exists($zipPath) ? filesize($zipPath) : 0;
            $checksum = file_exists($zipPath) ? hash_file('sha256', $zipPath) : '';

            $part = [
                'id' => 1,
                'part_number' => 1,
                'name' => "export_{$job->id}_part_1.zip",
                'size' => $fileSize,
                'size_bytes' => $fileSize,
                'checksum' => $checksum,
                'checksum_sha256' => $checksum,
                'status' => 'ready',
            ];

            $job->update([
                'status' => 'completed',
                'progress' => 'Packaging completed',
                'file_size' => $fileSize,
                'checksum' => $checksum,
                'parts' => [$part],
                'manifest' => $manifest,
            ]);
        } else {
            $job->update([
                'status' => 'failed',
                'failure_reason' => 'Unable to create zip archive.',
            ]);
        }

        return $this->successResponse([
            'job_id' => $job->id,
            'export_job' => $job->fresh(),
        ], 'Export job packaged successfully.', 201);
    }

    /**
     * Account-wide exports listing (API-9).
     */
    public function listAllExports(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = ExportJob::where('requester_id', $user->id);

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        $perPage = min((int)$request->input('per_page', 20), 100);
        $jobs = $query->orderBy('created_at', 'desc')->paginate($perPage);

        return $this->paginatedResponse($jobs);
    }

    /**
     * Get details for an export job (API-9).
     */
    public function getExport(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $job = ExportJob::where('requester_id', $user->id)->findOrFail($id);

        return $this->successResponse($job);
    }

    /**
     * Cancel an in-progress export job (API-9 / C-17).
     */
    public function cancelExport(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $job = ExportJob::where('requester_id', $user->id)->findOrFail($id);

        if (!in_array($job->status, ['queued', 'running'])) {
            return $this->errorResponse('Only queued or running export jobs can be cancelled.', 'CONFLICT', 409);
        }

        $job->update([
            'status' => 'cancelled',
            'failure_reason' => 'Cancelled by requester',
        ]);

        return $this->successResponse($job, 'Export job cancelled.');
    }

    /**
     * Retry a failed export job (API-9).
     */
    public function retryExport(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $job = ExportJob::where('requester_id', $user->id)->findOrFail($id);

        $job->update([
            'status' => 'queued',
            'failure_reason' => null,
            'progress' => '0 of 100 objects packaged',
        ]);

        return $this->successResponse($job, 'Export job queued for retry.');
    }

    /**
     * Get manifest for export job (API-9).
     */
    public function getManifest(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $job = ExportJob::where('requester_id', $user->id)->findOrFail($id);

        $manifest = $job->manifest ?? [
            'job_id' => $job->id,
            'scope' => $job->scope,
            'format' => $job->format,
            'files' => ["archive.{$job->format}", 'metadata.json'],
            'checksums' => ['archive' => $job->checksum ?? 'pending'],
        ];

        // What the export holds and what it left out, counted from the project it was made from.
        $projectId = $job->target_id;
        $manifest['counts'] = $manifest['counts'] ?? [
            'resources' => $projectId ? ProjectResource::where('project_id', $projectId)->count() : 0,
            'evidence_items' => $projectId ? EvidenceItem::where('project_id', $projectId)->count() : 0,
            'documents' => $projectId ? Document::where('project_id', $projectId)->count() : 0,
        ];
        $manifest['exclusions'] = $job->exclusions ?? [];

        return $this->successResponse($manifest);
    }

    /**
     * Download an export package part with permission check (API-9 / C-17).
     */
    public function downloadPart(Request $request, int $id, int $partId)
    {
        $user = $request->user();
        $job = ExportJob::where('requester_id', $user->id)->findOrFail($id);

        // Security check: verify caller still has active approved status
        if ($user->status !== 'approved' && !$user->is_admin) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'ACCESS_REVOKED',
                    'message' => 'Your researcher account access has been revoked or suspended.',
                ],
            ], 403);
        }

        // Enforce expiry check
        if ($job->expires_at && $job->expires_at->isPast()) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'EXPORT_EXPIRED',
                    'message' => 'This export package has expired.',
                ],
            ], 410);
        }

        // Single-archive packaging currently has 1 part (partId: 1)
        if ($partId !== 1) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'NOT_FOUND',
                    'message' => "Part {$partId} does not exist for this export.",
                ],
            ], 404);
        }

        $isDocx = $job->format === 'docx';
        $extension = $isDocx ? 'docx' : 'zip';
        $filePath = storage_path("app/exports/export_{$job->id}.{$extension}");

        if (!file_exists($filePath)) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'NOT_FOUND',
                    'message' => 'Export package file not found on disk or has expired.',
                ],
            ], 404);
        }

        return response()->download(
            $filePath,
            "export_{$job->id}_part_{$partId}.{$extension}",
            ['Content-Type' => $isDocx ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/zip']
        );
    }

    /**
     * Scope preview before starting export (API-9).
     */
    public function exportPreview(Request $request): JsonResponse
    {
        $user = $request->user();
        $validated = $request->validate([
            'scope' => 'required|string|in:document,resources,project,account',
            'ids' => 'nullable|array',
            'project_ids' => 'nullable|array',
        ]);

        $projectIds = $validated['project_ids'] ?? [];
        if ($validated['scope'] === 'project' && !empty($validated['ids'])) {
            $projectIds = array_merge($projectIds, $validated['ids']);
        }
        $projectIds = array_unique($projectIds);

        // Security check: verify caller has access to each specified project
        foreach ($projectIds as $pId) {
            $project = ResearchProject::where('is_deleted', false)->find($pId);
            if (!$project || !$this->policyService->canAccessProject($user, 'view', $project)) {
                return $this->errorResponse('Project not found or inaccessible.', 'NOT_FOUND', 404);
            }
        }

        if ($validated['scope'] === 'account') {
            $projectIds = ResearchProject::where(function ($q) use ($user) {
                $q->where('owner_id', $user->id)
                  ->orWhereHas('memberships', fn($mq) => $mq->where('user_id', $user->id)->where('status', 'accepted'));
            })->where('is_deleted', false)->pluck('id')->all();
        }

        $projectCount = count($projectIds);
        $resourceCount = ProjectResource::whereIn('project_id', $projectIds)->count();
        $evidenceCount = EvidenceItem::whereIn('project_id', $projectIds)->count();
        $documentCount = Document::whereIn('project_id', $projectIds)->count();

        if ($validated['scope'] === 'account') {
            $resourceCount += LibraryItem::where('user_id', $user->id)->count();
        }

        $estimatedBytes = ($evidenceCount * 10240) + ($documentCount * 51200) + ($resourceCount * 5120) + 10240;

        return $this->successResponse([
            'counts' => [
                'projects' => $projectCount,
                'resources' => $resourceCount,
                'evidence_items' => $evidenceCount,
                'documents' => $documentCount,
            ],
            'estimated_size_bytes' => max(4096, $estimatedBytes),
            'exclusions' => [],
        ]);
    }

    /**
     * Export storage quota and concurrency metrics (API-9).
     */
    public function getQuota(Request $request): JsonResponse
    {
        $user = $request->user();

        $runningCount = ExportJob::where('requester_id', $user->id)
            ->whereIn('status', ['queued', 'running'])
            ->count();

        $usedBytes = ExportJob::where('requester_id', $user->id)
            ->where('status', 'completed')
            ->sum('file_size') ?? (1024 * 1024 * 250);

        return $this->successResponse([
            'used_bytes' => (int)$usedBytes,
            'limit_bytes' => 5 * 1024 * 1024 * 1024, // 5 GB limit per API-9
            'concurrent_jobs' => $runningCount,
            'concurrent_limit' => 2,
        ]);
    }

    /**
     * Request and generate a project snapshot export (Module 9).
     */
    public function requestProjectExport(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $validated = $request->validate([
            'format' => 'nullable|string|in:json,csv,zip,html,pdf,md,bib,ris,docx',
        ]);

        $format = $validated['format'] ?? 'json';

        // Compile complete export snapshot (excluding other people's private annotations per DEF-4)
        $data = $this->compileProjectData($project, $request->user()?->id);
        $payload = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        $checksum = hash('sha256', $payload);
        $fileSize = strlen($payload);

        $exportDir = storage_path('app/exports');
        if (!file_exists($exportDir)) {
            mkdir($exportDir, 0755, true);
        }

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

        // The file that is downloaded later is this one, so the checksum above always matches it.
        file_put_contents($exportDir . DIRECTORY_SEPARATOR . "project_export_{$job->id}.json", $payload);

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

        $storedPath = storage_path("app/exports/project_export_{$job->id}.json");
        if (file_exists($storedPath)) {
            $content = file_get_contents($storedPath);
        } else {
            $content = json_encode($this->compileProjectData($project, $request->user()?->id), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        }

        return response($content, 200, [
            'Content-Type' => 'application/json; charset=utf-8',
            'Content-Disposition' => "attachment; filename=\"hadith_project_{$projectId}_export.json\"",
            'X-Checksum-SHA256' => $job->checksum,
        ]);
    }

    /**
     * Helper to assemble structured project research package.
     */
    private function compileProjectData(ResearchProject $project, ?int $userId = null): array
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
            'evidence_items' => $project->evidenceItems()->with([
                'annotations' => function ($q) use ($userId) {
                    $q->where(function ($sub) use ($userId) {
                        $sub->where('visibility', '!=', 'private');
                        if ($userId) {
                            $sub->orWhere('author_id', $userId);
                        }
                    });
                }
            ])->get(),
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
                    'evidence_id' => $n->evidence_id,
                    'finding_id' => $n->finding_id,
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
     * EXP-11: Import research package into a new private project with preview and multipart support (API-9).
     */
    public function importProjectPackage(Request $request): JsonResponse
    {
        $data = null;

        if ($request->hasFile('file')) {
            $data = $this->readPackageFile($request->file('file'));
        } elseif ($request->has('package_data')) {
            $data = $request->input('package_data');
        }

        if (!$data || !is_array($data)) {
            return $this->errorResponse('A valid package_data JSON or uploaded package archive file is required.', 'INVALID_PACKAGE', 422);
        }

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

        if ($request->boolean('preview_only')) {
            return $this->successResponse($preview, 'Research package preview generated.');
        }

        // Create new private project for current user, with what the package carries
        $newProject = DB::transaction(function () use ($request, $projMeta, $data) {
            $newProject = ResearchProject::create([
                'title' => $request->input('new_title', ("Imported: " . ($projMeta['title'] ?? 'Research Project'))),
                'owner_id' => $request->user()->id,
                'question' => $projMeta['question'] ?? 'Imported research question',
                'scope' => $projMeta['scope'] ?? 'Imported project',
                'stage' => 'collecting',
                'is_deleted' => false,
            ]);

            \App\Models\ProjectMembership::create([
                'project_id' => $newProject->id,
                'user_id' => $request->user()->id,
                'role' => 'owner',
                'status' => 'accepted',
                'accepted_at' => now(),
            ]);

            $this->importPackageContents($newProject, $data, $request->user()->id);

            return $newProject;
        });

        $preview['imported'] = [
            'findings' => $newProject->findings()->count(),
            'documents' => $newProject->documents()->count(),
            'arguments' => \App\Models\ArgumentNode::where('project_id', $newProject->id)->count(),
        ];
        // Evidence and resources point at the exporter's library and at corpus entries, so they are not carried over.
        $preview['not_imported'] = ['resources', 'evidence_items'];

        return $this->successResponse([
            'project' => $newProject->load('owner'),
            'imported_summary' => $preview,
        ], 'Research package successfully imported into new project.', 201);
    }

    /**
     * Read an uploaded package: a JSON file, or a ZIP made by this platform (its first projects/project_*.json).
     */
    private function readPackageFile(\Illuminate\Http\UploadedFile $file): ?array
    {
        $raw = file_get_contents($file->getRealPath());
        if ($raw === false) {
            return null;
        }
        if (str_starts_with($raw, 'PK')) {
            $zip = new \ZipArchive();
            if ($zip->open($file->getRealPath()) !== true) {
                return null;
            }
            $raw = null;
            for ($i = 0; $i < $zip->numFiles; $i++) {
                $name = $zip->getNameIndex($i);
                if (preg_match('#^projects/project_\d+\.json$#', $name)) {
                    $raw = $zip->getFromIndex($i);
                    break;
                }
            }
            $zip->close();
            if ($raw === null) {
                return null;
            }
        }
        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : null;
    }

    /**
     * Create the findings, documents (their latest text as version 1) and argument map that a package carries.
     */
    private function importPackageContents(ResearchProject $project, array $data, int $userId): void
    {
        foreach (($data['findings'] ?? []) as $f) {
            if (!is_array($f) || empty($f['claim'])) {
                continue;
            }
            \App\Models\Finding::create([
                'project_id' => $project->id,
                'question' => $f['question'] ?? 'Imported question',
                'claim' => $f['claim'],
                'reasoning' => $f['reasoning'] ?? '',
                'limitations' => $f['limitations'] ?? null,
                'status' => in_array($f['status'] ?? null, ['provisional', 'supported', 'inconclusive', 'disputed', 'withdrawn'], true) ? $f['status'] : 'provisional',
            ]);
        }

        foreach (($data['documents'] ?? []) as $d) {
            if (!is_array($d) || empty($d['title'])) {
                continue;
            }
            $doc = Document::create([
                'project_id' => $project->id,
                'title' => $d['title'],
                'document_type' => in_array($d['document_type'] ?? null, ['article', 'dossier', 'dataset_note'], true) ? $d['document_type'] : 'article',
                'language' => $d['language'] ?? 'ar',
            ]);
            \App\Models\DocumentVersion::create([
                'document_id' => $doc->id,
                'version_number' => 1,
                'content' => (string) ($d['latest_version']['content'] ?? $d['content'] ?? ''),
                'author_id' => $userId,
                'change_summary' => 'Imported from a research package',
                'created_at' => now(),
            ]);
        }

        $nodeMap = [];
        foreach (($data['argument_nodes'] ?? []) as $n) {
            if (!is_array($n) || empty($n['title'])) {
                continue;
            }
            $node = \App\Models\ArgumentNode::create([
                'project_id' => $project->id,
                'node_type' => $n['node_type'] ?? 'premise',
                'title' => $n['title'],
                'content' => $n['content'] ?? null,
                'order_index' => $n['order_index'] ?? 0,
                'created_by' => $userId,
            ]);
            if (isset($n['id'])) {
                $nodeMap[$n['id']] = $node->id;
            }
        }
        foreach (($data['argument_edges'] ?? []) as $e) {
            $from = $e['source_node_id'] ?? null;
            $to = $e['target_node_id'] ?? null;
            if (!is_array($e) || !isset($nodeMap[$from], $nodeMap[$to])) {
                continue;
            }
            \App\Models\ArgumentEdge::create([
                'project_id' => $project->id,
                'source_node_id' => $nodeMap[$from],
                'target_node_id' => $nodeMap[$to],
                'relation_type' => $e['relation_type'] ?? 'supports',
                'notes' => $e['notes'] ?? null,
                'created_at' => now(),
            ]);
        }
    }

    /**
     * Write a minimal Word document: ['heading'|'heading2'|'text', string] lines become paragraphs.
     */
    private function writeDocx(string $path, array $lines): void
    {
        $esc = fn(string $t) => htmlspecialchars($t, ENT_XML1 | ENT_QUOTES, 'UTF-8');
        $body = '';
        foreach ($lines as [$kind, $text]) {
            $style = match ($kind) {
                'heading' => '<w:pPr><w:pStyle w:val="Heading1"/></w:pPr>',
                'heading2' => '<w:pPr><w:pStyle w:val="Heading2"/></w:pPr>',
                default => '',
            };
            $body .= '<w:p>' . $style . '<w:r><w:t xml:space="preserve">' . $esc($text) . '</w:t></w:r></w:p>';
        }
        if ($body === '') {
            $body = '<w:p/>';
        }

        $zip = new \ZipArchive();
        $zip->open($path, \ZipArchive::CREATE | \ZipArchive::OVERWRITE);
        $zip->addFromString('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
        $zip->addFromString('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
        $zip->addFromString('word/document.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' . $body . '</w:body></w:document>');
        $zip->close();
    }
}
