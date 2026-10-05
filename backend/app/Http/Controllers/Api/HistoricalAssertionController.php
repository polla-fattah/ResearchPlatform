<?php

namespace App\Http\Controllers\Api;

use App\Models\HistoricalAssertion;
use App\Models\ResearchProject;
use App\Services\AuthPolicyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HistoricalAssertionController extends ApiController
{
    public function __construct(
        protected AuthPolicyService $policyService
    ) {}

    public function index(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $query = HistoricalAssertion::where('project_id', $projectId)
            ->with('creator');

        if ($request->has('subject_type')) {
            $query->where('subject_type', $request->query('subject_type'));
        }

        if ($request->has('uncertainty_level')) {
            $query->where('uncertainty_level', $request->query('uncertainty_level'));
        }

        $assertions = $query->orderBy('created_at', 'desc')->get();

        return $this->successResponse($assertions, 'Historical assertions retrieved.');
    }

    public function store(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $validated = $request->validate([
            'subject_type' => 'required|string|in:narrator,event,report,text_reading,general',
            'subject_id' => 'nullable|integer',
            'subject_name' => 'required|string|max:255',
            'assertion_claim' => 'required|string',
            'uncertainty_level' => 'nullable|string|in:certain,highly_probable,probable,contested,speculative',
            'competing_alternatives' => 'nullable|array',
            'adjudication_notes' => 'nullable|string',
        ]);

        $assertion = HistoricalAssertion::create([
            'project_id' => $projectId,
            'subject_type' => $validated['subject_type'],
            'subject_id' => $validated['subject_id'] ?? null,
            'subject_name' => $validated['subject_name'],
            'assertion_claim' => $validated['assertion_claim'],
            'uncertainty_level' => $validated['uncertainty_level'] ?? 'probable',
            'competing_alternatives' => $validated['competing_alternatives'] ?? [],
            'adjudication_notes' => $validated['adjudication_notes'] ?? null,
            'created_by' => $request->user()->id,
        ]);

        return $this->successResponse($assertion->load('creator'), 'Historical assertion recorded.', 201);
    }

    public function show(Request $request, int $projectId, int $id): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $assertion = HistoricalAssertion::where('project_id', $projectId)
            ->with('creator')
            ->findOrFail($id);

        return $this->successResponse($assertion);
    }

    public function update(Request $request, int $projectId, int $id): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $assertion = HistoricalAssertion::where('project_id', $projectId)->findOrFail($id);

        $validated = $request->validate([
            'assertion_claim' => 'nullable|string',
            'uncertainty_level' => 'nullable|string|in:certain,highly_probable,probable,contested,speculative',
            'competing_alternatives' => 'nullable|array',
            'adjudication_notes' => 'nullable|string',
        ]);

        $assertion->update(array_filter($validated, fn($val) => !is_null($val)));

        return $this->successResponse($assertion->fresh('creator'), 'Historical assertion updated.');
    }

    public function destroy(Request $request, int $projectId, int $id): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $assertion = HistoricalAssertion::where('project_id', $projectId)->findOrFail($id);
        $assertion->delete();

        return $this->successResponse(null, 'Historical assertion deleted.');
    }
}
