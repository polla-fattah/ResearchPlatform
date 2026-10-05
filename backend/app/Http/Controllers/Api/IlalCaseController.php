<?php

namespace App\Http\Controllers\Api;

use App\Models\ResearchProject;
use App\Models\IlalCase;
use App\Services\AuthPolicyService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class IlalCaseController extends ApiController
{
    public function __construct(
        protected AuthPolicyService $policyService
    ) {}

    /**
     * List all 'Ilal cases in the project.
     */
    public function index(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $cases = IlalCase::where('project_id', $projectId)
            ->with('creator')
            ->latest('created_at')
            ->get();

        return $this->successResponse($cases);
    }

    /**
     * Create an 'Ilal investigation case.
     */
    public function store(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'discrepancy_category' => 'required|string|in:irsal_vs_ittisal,waqf_vs_raf,ziyadah_thiqah,tashif,qalb,ikhtilaf_sanad,shudhudh',
            'competing_variants' => 'nullable|array',
            'critics_judgments' => 'nullable|array',
            'preferred_version' => 'nullable|string',
            'resolution_notes' => 'nullable|string',
        ]);

        $case = IlalCase::create([
            'project_id' => $projectId,
            'title' => $validated['title'],
            'discrepancy_category' => $validated['discrepancy_category'],
            'competing_variants' => $validated['competing_variants'] ?? [],
            'critics_judgments' => $validated['critics_judgments'] ?? [],
            'preferred_version' => $validated['preferred_version'] ?? null,
            'status' => 'under_investigation',
            'resolution_notes' => $validated['resolution_notes'] ?? null,
            'created_by' => $request->user()->id,
        ]);

        return $this->successResponse($case->load('creator'), "'Ilal investigation case registered.", 201);
    }

    /**
     * View 'Ilal case details.
     */
    public function show(Request $request, int $projectId, int $caseId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $case = IlalCase::where('project_id', $projectId)
            ->with('creator')
            ->findOrFail($caseId);

        return $this->successResponse($case);
    }

    /**
     * Update/resolve 'Ilal case.
     */
    public function update(Request $request, int $projectId, int $caseId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $case = IlalCase::where('project_id', $projectId)->findOrFail($caseId);

        $validated = $request->validate([
            'title' => 'nullable|string|max:255',
            'status' => 'nullable|string|in:under_investigation,resolved_authentic,resolved_defective,inconclusive',
            'preferred_version' => 'nullable|string',
            'resolution_notes' => 'nullable|string',
            'competing_variants' => 'nullable|array',
            'critics_judgments' => 'nullable|array',
        ]);

        $case->update($validated);

        return $this->successResponse($case->load('creator'), "'Ilal case updated.");
    }
}
