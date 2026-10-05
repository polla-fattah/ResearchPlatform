<?php

namespace App\Http\Controllers\Api;

use App\Models\ResearchProject;
use App\Models\SavedQuery;
use App\Models\SearchRun;
use App\Models\SearchSubscription;
use App\Services\AuthPolicyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SearchSubscriptionController extends ApiController
{
    public function __construct(
        protected AuthPolicyService $policyService
    ) {}

    public function index(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $subscriptions = SearchSubscription::where('project_id', $projectId)
            ->with(['savedQuery', 'user'])
            ->get();

        return $this->successResponse($subscriptions, 'Search subscriptions retrieved.');
    }

    public function store(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $validated = $request->validate([
            'saved_query_id' => 'required|integer|exists:saved_queries,id',
            'frequency' => 'nullable|string|in:daily,weekly,monthly',
        ]);

        $sub = SearchSubscription::updateOrCreate(
            [
                'project_id' => $projectId,
                'user_id' => $request->user()->id,
                'saved_query_id' => $validated['saved_query_id'],
            ],
            [
                'frequency' => $validated['frequency'] ?? 'weekly',
                'is_active' => true,
            ]
        );

        return $this->successResponse($sub->load('savedQuery'), 'Subscribed to scheduled search alerts.', 201);
    }

    public function toggle(Request $request, int $projectId, int $id): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $sub = SearchSubscription::where('project_id', $projectId)->findOrFail($id);
        $sub->is_active = !$sub->is_active;
        $sub->save();

        return $this->successResponse($sub, 'Subscription status toggled.');
    }

    /**
     * SEA-09: Compare two search runs and compute added/removed/retained items.
     */
    public function compareRuns(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $validated = $request->validate([
            'run_id_1' => 'nullable|integer|exists:search_runs,id',
            'run_id_2' => 'nullable|integer|exists:search_runs,id',
            'result_set_id_1' => 'nullable|integer|exists:result_sets,id',
            'result_set_id_2' => 'nullable|integer|exists:result_sets,id',
            'ids_1' => 'nullable|array',
            'ids_2' => 'nullable|array',
        ]);

        $ids1 = $validated['ids_1'] ?? [];
        $ids2 = $validated['ids_2'] ?? [];

        if (!empty($validated['result_set_id_1'])) {
            $ids1 = \App\Models\ResultSetMember::where('result_set_id', $validated['result_set_id_1'])->pluck('corpus_id')->toArray();
        }
        if (!empty($validated['result_set_id_2'])) {
            $ids2 = \App\Models\ResultSetMember::where('result_set_id', $validated['result_set_id_2'])->pluck('corpus_id')->toArray();
        }
        if (!empty($validated['run_id_1']) && empty($ids1)) {
            $rs = \App\Models\ResultSet::where('search_run_id', $validated['run_id_1'])->first();
            if ($rs) {
                $ids1 = \App\Models\ResultSetMember::where('result_set_id', $rs->id)->pluck('corpus_id')->toArray();
            }
        }
        if (!empty($validated['run_id_2']) && empty($ids2)) {
            $rs = \App\Models\ResultSet::where('search_run_id', $validated['run_id_2'])->first();
            if ($rs) {
                $ids2 = \App\Models\ResultSetMember::where('result_set_id', $rs->id)->pluck('corpus_id')->toArray();
            }
        }

        $added = array_values(array_diff($ids2, $ids1));
        $removed = array_values(array_diff($ids1, $ids2));
        $retained = array_values(array_intersect($ids1, $ids2));

        return $this->successResponse([
            'run_1' => [
                'id' => $validated['run_id_1'] ?? null,
                'total_results' => count($ids1),
            ],
            'run_2' => [
                'id' => $validated['run_id_2'] ?? null,
                'total_results' => count($ids2),
            ],
            'diff' => [
                'added_count' => count($added),
                'removed_count' => count($removed),
                'retained_count' => count($retained),
                'added_ids' => $added,
                'removed_ids' => $removed,
                'retained_ids' => $retained,
            ],
        ], 'Search run comparison completed.');
    }
}
