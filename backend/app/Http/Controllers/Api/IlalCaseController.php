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
            'expected_updated_at' => 'nullable|date',
        ]);

        // A write made from an older copy than the one stored is refused, so a teammate's change is not overwritten.
        if (!empty($validated['expected_updated_at']) && $case->updated_at
            && \Illuminate\Support\Carbon::parse($validated['expected_updated_at'])->timestamp !== $case->updated_at->timestamp) {
            return $this->errorResponse(
                'This case was changed by someone else since you opened it.',
                'CONFLICT',
                409,
                ['current' => $case->load('creator')]
            );
        }
        unset($validated['expected_updated_at']);

        $variants = $validated['competing_variants'] ?? $case->competing_variants ?? [];
        $variantNames = array_map(fn ($v) => trim((string) ($v['name'] ?? '')), $variants);
        $status = $validated['status'] ?? $case->status;

        if (str_starts_with($status, 'resolved') && count(array_filter($variantNames)) < 2) {
            return $this->errorResponse('A case needs at least two versions before it can be concluded.', 'NEEDS_TWO_VERSIONS', 422);
        }

        $preferred = trim((string) ($validated['preferred_version'] ?? ''));
        if (array_key_exists('preferred_version', $validated) && $preferred !== '' && !in_array($preferred, $variantNames, true)) {
            return $this->errorResponse("The preferred version must be one of the case's versions.", 'UNKNOWN_VERSION', 422);
        }

        $case->update($validated);

        return $this->successResponse($case->load('creator'), "'Ilal case updated.");
    }

    /**
     * Delete a case.
     */
    public function destroy(Request $request, int $projectId, int $caseId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        IlalCase::where('project_id', $projectId)->findOrFail($caseId)->delete();

        return $this->successResponse(null, "'Ilal case deleted.");
    }
}
