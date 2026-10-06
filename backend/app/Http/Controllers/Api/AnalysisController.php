<?php

namespace App\Http\Controllers\Api;

use App\Models\ResearchProject;
use App\Models\AnalysisRun;
use App\Services\AnalysisWorkbenchService;
use App\Services\CollationEngineService;
use App\Services\IsnadTopologyService;
use App\Services\TemporalCspService;
use App\Services\AuthPolicyService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Throwable;

class AnalysisController extends ApiController
{
    public function __construct(
        protected AnalysisWorkbenchService $workbenchService,
        protected CollationEngineService $collationService,
        protected IsnadTopologyService $isnadTopologyService,
        protected TemporalCspService $temporalCspService,
        protected AuthPolicyService $policyService
    ) {}

    /**
     * Side-by-side textual occurrence comparison (Matn Compare).
     */
    public function matnCompare(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $validated = $request->validate([
            'hadith_ids' => 'nullable|array',
            'hadith_ids.*' => 'integer',
            'baseline_id' => 'nullable|integer',
            'custom_texts' => 'nullable|array',
            'save_run' => 'nullable|boolean',
        ]);

        try {
            $hadithIds = $validated['hadith_ids'] ?? [];
            $customTexts = $validated['custom_texts'] ?? [];
            $baselineId = $validated['baseline_id'] ?? null;

            $result = $this->workbenchService->matnCompare($hadithIds, $baselineId, $customTexts);

            $runRecord = null;
            if (!empty($validated['save_run'])) {
                $this->policyService->authorizeProject($request->user(), 'edit', $project);
                $version = (AnalysisRun::where('project_id', $projectId)
                    ->where('analysis_type', 'matn_comparison')
                    ->max('version_number') ?? 0) + 1;

                $runRecord = AnalysisRun::create([
                    'project_id' => $projectId,
                    'analysis_type' => 'matn_comparison',
                    'input_params' => [
                        'hadith_ids' => $hadithIds,
                        'baseline_id' => $baselineId,
                        'custom_texts' => $customTexts,
                    ],
                    'output_data' => $result,
                    'version_number' => $version,
                    'created_by' => $request->user()->id,
                    'created_at' => now(),
                ]);
            }

            return $this->successResponse([
                'analysis' => $result,
                'saved_run' => $runRecord,
            ], 'Matn comparison executed.');
        } catch (Throwable $e) {
            return $this->errorResponse($e->getMessage(), 'ANALYSIS_ERROR', 422);
        }
    }

    /**
     * Transmission chain comparison & Common Link (Madar) detection (Isnad Compare).
     */
    public function isnadCompare(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $validated = $request->validate([
            'sanad_ids' => 'required|array|min:2',
            'sanad_ids.*' => 'integer',
            'save_run' => 'nullable|boolean',
        ]);

        try {
            $result = $this->workbenchService->isnadCompare($validated['sanad_ids']);

            $runRecord = null;
            if (!empty($validated['save_run'])) {
                $this->policyService->authorizeProject($request->user(), 'edit', $project);
                $version = (AnalysisRun::where('project_id', $projectId)
                    ->where('analysis_type', 'isnad_comparison')
                    ->max('version_number') ?? 0) + 1;

                $runRecord = AnalysisRun::create([
                    'project_id' => $projectId,
                    'analysis_type' => 'isnad_comparison',
                    'input_params' => [
                        'sanad_ids' => $validated['sanad_ids'],
                    ],
                    'output_data' => $result,
                    'version_number' => $version,
                    'created_by' => $request->user()->id,
                    'created_at' => now(),
                ]);
            }

            return $this->successResponse([
                'analysis' => $result,
                'saved_run' => $runRecord,
            ], 'Isnad comparison executed.');
        } catch (Throwable $e) {
            return $this->errorResponse($e->getMessage(), 'ANALYSIS_ERROR', 422);
        }
    }

    /**
     * Jarh wa Ta'dil cross-tabulated criticism matrix.
     */
    public function criticismMatrix(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $validated = $request->validate([
            'narrator_ids' => 'required|array|min:1',
            'narrator_ids.*' => 'integer',
            'scholar_ids' => 'nullable|array',
            'scholar_ids.*' => 'integer',
            'save_run' => 'nullable|boolean',
        ]);

        try {
            $narratorIds = $validated['narrator_ids'];
            $scholarIds = $validated['scholar_ids'] ?? [];

            $result = $this->workbenchService->criticismMatrix($narratorIds, $scholarIds);

            $runRecord = null;
            if (!empty($validated['save_run'])) {
                $this->policyService->authorizeProject($request->user(), 'edit', $project);
                $version = (AnalysisRun::where('project_id', $projectId)
                    ->where('analysis_type', 'criticism_matrix')
                    ->max('version_number') ?? 0) + 1;

                $runRecord = AnalysisRun::create([
                    'project_id' => $projectId,
                    'analysis_type' => 'criticism_matrix',
                    'input_params' => [
                        'narrator_ids' => $narratorIds,
                        'scholar_ids' => $scholarIds,
                    ],
                    'output_data' => $result,
                    'version_number' => $version,
                    'created_by' => $request->user()->id,
                    'created_at' => now(),
                ]);
            }

            return $this->successResponse([
                'analysis' => $result,
                'saved_run' => $runRecord,
            ], 'Criticism matrix generated.');
        } catch (Throwable $e) {
            return $this->errorResponse($e->getMessage(), 'ANALYSIS_ERROR', 422);
        }
    }

    /**
     * List saved analysis runs for project.
     */
    public function index(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $query = AnalysisRun::where('project_id', $projectId)
            ->with(['creator' => fn($q) => $q->select('id', 'display_name')]);

        if ($request->filled('type')) {
            $query->where('analysis_type', $request->input('type'));
        }

        $runs = $query->latest('created_at')->get();

        return $this->successResponse($runs);
    }

    /**
     * Persist an analysis run with parameters and outputs.
     */
    public function save(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $validated = $request->validate([
            'analysis_type' => 'required|string|in:matn_comparison,isnad_comparison,narrator_dossier,criticism_matrix,ilal_case',
            'input_params' => 'required|array',
            'output_data' => 'required|array',
        ]);

        $version = (AnalysisRun::where('project_id', $projectId)
            ->where('analysis_type', $validated['analysis_type'])
            ->max('version_number') ?? 0) + 1;

        $run = AnalysisRun::create([
            'project_id' => $projectId,
            'analysis_type' => $validated['analysis_type'],
            'input_params' => $validated['input_params'],
            'output_data' => $validated['output_data'],
            'version_number' => $version,
            'created_by' => $request->user()->id,
            'created_at' => now(),
        ]);

        return $this->successResponse(
            $run->load(['creator' => fn($q) => $q->select('id', 'display_name')]),
            'Analysis run archived.',
            201
        );
    }

    /**
     * Retrieve single saved analysis run.
     */
    public function show(Request $request, int $projectId, int $analysisId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $run = AnalysisRun::where('project_id', $projectId)
            ->with([
                'creator' => fn($q) => $q->select('id', 'display_name'),
                'project:id,title',
            ])
            ->findOrFail($analysisId);

        return $this->successResponse($run);
    }

    /**
     * Delete a saved analysis run (C-19).
     */
    public function destroy(Request $request, int $projectId, int $analysisId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $run = AnalysisRun::where('project_id', $projectId)->findOrFail($analysisId);
        $run->delete();

        return $this->successResponse([], 'Analysis run deleted.');
    }

    /**
     * ANA-06: Advanced Sequence Collation & Critical Apparatus (Hirschberg / Needleman-Wunsch).
     */
    public function collate(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        if (trim($request->input('baseline_text', '')) === '') {
            return $this->errorResponse('Baseline text cannot be blank or whitespace-only.', 'EMPTY_BASELINE', 422);
        }

        $validated = $request->validate([
            'baseline_text' => 'required|string|max:50000',
            'variants' => 'required|array|min:1|max:10',
            'variants.*.text' => 'required|string|max:50000',
            'variants.*.label' => 'nullable|string|max:255',
            'variants.*.id' => 'nullable',
            'save_run' => 'nullable|boolean',
        ]);

        try {
            $result = $this->collationService->collateVariants(
                $validated['baseline_text'],
                $validated['variants']
            );

            $runRecord = null;
            if (!empty($validated['save_run'])) {
                $this->policyService->authorizeProject($request->user(), 'edit', $project);
                $version = (AnalysisRun::where('project_id', $projectId)
                    ->where('analysis_type', 'sequence_collation')
                    ->max('version_number') ?? 0) + 1;

                $runRecord = AnalysisRun::create([
                    'project_id' => $projectId,
                    'analysis_type' => 'sequence_collation',
                    'input_params' => [
                        'baseline_text' => $validated['baseline_text'],
                        'variant_count' => count($validated['variants']),
                        'variants' => array_map(fn($v) => [
                            'id' => $v['id'] ?? null,
                            'label' => $v['label'] ?? null,
                        ], $validated['variants']),
                        'variant_ids' => array_values(array_filter(array_column($validated['variants'], 'id'))),
                        'variant_labels' => array_values(array_filter(array_column($validated['variants'], 'label'))),
                    ],
                    'output_data' => $result,
                    'version_number' => $version,
                    'created_by' => $request->user()->id,
                    'created_at' => now(),
                ]);
            }

            return $this->successResponse([
                'collation' => $result,
                'saved_run' => $runRecord,
            ], 'Sequence collation and critical apparatus generated.');
        } catch (Throwable $e) {
            return $this->errorResponse($e->getMessage(), 'COLLATION_ERROR', 422);
        }
    }

    /**
     * ANA-07: Topological transmission DAG analysis & Madār al-Isnād (Common Link) detection.
     */
    public function isnadTopology(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $validated = $request->validate([
            'sanad_ids' => 'nullable|array',
            'sanad_ids.*' => 'integer',
            'custom_chains' => 'nullable|array|min:2',
            'custom_chains.*' => 'array|min:2',
            'direction' => 'nullable|string|in:author_to_source,source_to_author',
            'save_run' => 'nullable|boolean',
        ]);

        if (empty($validated['sanad_ids']) && empty($validated['custom_chains'])) {
            return $this->errorResponse('Either sanad_ids (min 2) or custom_chains (min 2) must be provided.', 'INVALID_PARAMETERS', 422);
        }

        if (!empty($validated['custom_chains'])) {
            foreach ($validated['custom_chains'] as $chain) {
                $seen = [];
                foreach ($chain as $n) {
                    $nid = is_array($n) ? ($n['id'] ?? $n['name'] ?? null) : $n;
                    if (in_array($nid, $seen, true)) {
                        return $this->errorResponse(
                            'Cycle detected in chain. A chain that names the same narrator twice is invalid.',
                            'CHAIN_CYCLE_DETECTED',
                            422
                        );
                    }
                    $seen[] = $nid;
                }
            }
        }

        try {
            $result = $this->isnadTopologyService->analyzeChains(
                $validated['sanad_ids'] ?? [],
                $validated['custom_chains'] ?? [],
                $validated['direction'] ?? 'author_to_source'
            );

            $runRecord = null;
            if (!empty($validated['save_run'])) {
                $this->policyService->authorizeProject($request->user(), 'edit', $project);
                $version = (AnalysisRun::where('project_id', $projectId)
                    ->where('analysis_type', 'isnad_topology')
                    ->max('version_number') ?? 0) + 1;

                $runRecord = AnalysisRun::create([
                    'project_id' => $projectId,
                    'analysis_type' => 'isnad_topology',
                    'input_params' => [
                        'sanad_ids' => $validated['sanad_ids'] ?? null,
                        'custom_chains_count' => count($validated['custom_chains'] ?? []),
                    ],
                    'output_data' => $result,
                    'version_number' => $version,
                    'created_by' => $request->user()->id,
                    'created_at' => now(),
                ]);
            }

            return $this->successResponse([
                'topology' => $result,
                'saved_run' => $runRecord,
            ], 'Isnād graph topology and Madār analysis completed.');
        } catch (Throwable $e) {
            return $this->errorResponse($e->getMessage(), 'TOPOLOGY_ERROR', 422);
        }
    }

    /**
     * ANA-10: Temporal constraint satisfaction (CSP) & chronological feasibility verification.
     */
    public function temporalCheck(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $validated = $request->validate([
            'teacher_name' => 'nullable|string',
            'teacher_birth' => 'nullable|integer',
            'teacher_death' => 'nullable|integer',
            'student_name' => 'nullable|string',
            'student_birth' => 'nullable|integer',
            'student_death' => 'nullable|integer',
            'narrators_chain' => 'nullable|array',
            'min_audition_age' => 'nullable|integer|min:5|max:15',
            'save_run' => 'nullable|boolean',
        ]);

        try {
            if (!empty($validated['narrators_chain'])) {
                $result = $this->temporalCspService->verifyChainChronology($validated['narrators_chain']);
            } else {
                $teacherName = $validated['teacher_name'] ?? 'Teacher';
                $studentName = $validated['student_name'] ?? 'Student';
                $minAge = $validated['min_audition_age'] ?? TemporalCspService::MINIMUM_TAMYIZ_AGE;

                $result = $this->temporalCspService->checkTeacherStudentPair(
                    $teacherName,
                    $validated['teacher_birth'] ?? null,
                    $validated['teacher_death'] ?? null,
                    $studentName,
                    $validated['student_birth'] ?? null,
                    $validated['student_death'] ?? null,
                    $minAge
                );
            }

            $runRecord = null;
            if (!empty($validated['save_run'])) {
                $this->policyService->authorizeProject($request->user(), 'edit', $project);
                $version = (AnalysisRun::where('project_id', $projectId)
                    ->where('analysis_type', 'temporal_csp')
                    ->max('version_number') ?? 0) + 1;

                $runRecord = AnalysisRun::create([
                    'project_id' => $projectId,
                    'analysis_type' => 'temporal_csp',
                    'input_params' => $validated,
                    'output_data' => $result,
                    'version_number' => $version,
                    'created_by' => $request->user()->id,
                    'created_at' => now(),
                ]);
            }

            return $this->successResponse([
                'temporal_verification' => $result,
                'saved_run' => $runRecord,
            ], 'Temporal chronological constraint verification executed.');
        } catch (Throwable $e) {
            return $this->errorResponse($e->getMessage(), 'TEMPORAL_ERROR', 422);
        }
    }
}
