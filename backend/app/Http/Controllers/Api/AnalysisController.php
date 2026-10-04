<?php

namespace App\Http\Controllers\Api;

use App\Models\ResearchProject;
use App\Models\AnalysisRun;
use App\Services\AnalysisWorkbenchService;
use App\Services\AuthPolicyService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Throwable;

class AnalysisController extends ApiController
{
    public function __construct(
        protected AnalysisWorkbenchService $workbenchService,
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
            ->with('creator');

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

        return $this->successResponse($run->load('creator'), 'Analysis run archived.', 201);
    }

    /**
     * Retrieve single saved analysis run.
     */
    public function show(Request $request, int $projectId, int $analysisId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $run = AnalysisRun::where('project_id', $projectId)
            ->with(['creator', 'project'])
            ->findOrFail($analysisId);

        return $this->successResponse($run);
    }
}
