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
            'year_hijri' => 'nullable|integer|min:-1000|max:2000',
            'source' => 'nullable|string|max:500',
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
            'year_hijri' => $validated['year_hijri'] ?? null,
            'source' => $validated['source'] ?? null,
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
            'year_hijri' => 'nullable|integer|min:-1000|max:2000',
            'source' => 'nullable|string|max:500',
        ]);

        // A field that was sent as null or '' is cleared; a field that was not sent is left alone. The claim cannot be emptied.
        $changes = array_intersect_key($validated, $request->all());
        if (array_key_exists('assertion_claim', $changes) && ($changes['assertion_claim'] === null || $changes['assertion_claim'] === '')) {
            unset($changes['assertion_claim']);
        }
        if (array_key_exists('uncertainty_level', $changes) && $changes['uncertainty_level'] === null) {
            unset($changes['uncertainty_level']);
        }
        if (array_key_exists('competing_alternatives', $changes) && $changes['competing_alternatives'] === null) {
            $changes['competing_alternatives'] = [];
        }
        $assertion->update($changes);

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
