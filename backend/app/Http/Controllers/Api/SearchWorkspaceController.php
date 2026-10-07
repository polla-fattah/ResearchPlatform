<?php

namespace App\Http\Controllers\Api;

use App\Models\ResearchProject;
use App\Models\SavedQuery;
use App\Models\SearchRun;
use App\Models\ResultSet;
use App\Models\ResultSetMember;
use App\Models\Corpus\CorpusHadith;
use App\Services\AuthPolicyService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class SearchWorkspaceController extends ApiController
{
    public function __construct(
        protected AuthPolicyService $policyService
    ) {}

    /**
     * List saved search queries for a project (Module 5).
     */
    public function index(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $perPage = min((int) ($request->input('per_page', 20)), 100);
        $queries = SavedQuery::where('owner_type', 'project')
            ->where('owner_id', $projectId)
            ->with(['searchRuns' => fn($q) => $q->latest('created_at')->limit(5)])
            ->latest('created_at')
            ->paginate($perPage);

        return $this->paginatedResponse($queries);
    }

    /**
     * Save a search query definition.
     */
    public function store(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'query_text' => 'required|string|min:2',
            'search_mode' => 'nullable|string|in:normalized,exact,fts',
            'filter_criteria' => 'nullable|array',
        ]);

        $savedQuery = SavedQuery::create([
            'owner_type' => 'project',
            'owner_id' => $projectId,
            'name' => $validated['name'],
            'query_text' => $validated['query_text'],
            'search_mode' => $validated['search_mode'] ?? 'normalized',
            'filter_criteria' => $validated['filter_criteria'] ?? [],
        ]);

        return $this->successResponse($savedQuery, 'Search query saved.', 201);
    }

    /**
     * Retrieve single saved search query with historical runs.
     */
    public function show(Request $request, int $projectId, int $queryId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $query = SavedQuery::where('owner_type', 'project')
            ->where('owner_id', $projectId)
            ->with(['searchRuns' => fn($q) => $q->latest('created_at')])
            ->findOrFail($queryId);

        return $this->successResponse($query);
    }

    /**
     * Update project saved query.
     */
    public function update(Request $request, int $projectId, int $queryId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $query = SavedQuery::where('owner_type', 'project')
            ->where('owner_id', $projectId)
            ->findOrFail($queryId);

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'query_text' => 'sometimes|required|string|min:2',
            'search_mode' => 'nullable|string|in:normalized,exact,fts',
            'filter_criteria' => 'nullable|array',
        ]);

        $query->update($validated);

        return $this->successResponse($query, 'Saved search query updated.');
    }

    /**
     * Delete project saved query.
     */
    public function destroy(Request $request, int $projectId, int $queryId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $query = SavedQuery::where('owner_type', 'project')
            ->where('owner_id', $projectId)
            ->findOrFail($queryId);

        $query->delete();

        return $this->successResponse(null, 'Saved search query deleted.');
    }

    /**
     * Execute a saved search query against the corpus, applying filter_criteria and persisting hits (DEF-11 / API-6).
     */
    public function run(Request $request, int $projectId, int $queryId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $query = SavedQuery::where('owner_type', 'project')
            ->where('owner_id', $projectId)
            ->findOrFail($queryId);

        $result = app(\App\Services\SavedQueryRunner::class)->run($query, (int) $request->input('limit', 100));
        $searchRun = $result['search_run'];
        $matches = $result['matches'];
        $isTruncated = $result['truncated'];
        $totalAvailable = $result['total_available'];

        return $this->successResponse([
            'search_run' => $searchRun,
            'query' => $query,
            'matches' => $matches,
            'truncated' => $isTruncated,
            'total_available' => $totalAvailable,
        ], 'Search executed successfully.');
    }

    /**
     * List all search runs across project queries (API-6).
     */
    public function listSearchRuns(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $queryIds = SavedQuery::where('owner_type', 'project')
            ->where('owner_id', $projectId)
            ->pluck('id');

        $perPage = min((int)$request->input('per_page', 20), 100);
        $runs = SearchRun::whereIn('saved_query_id', $queryIds)
            ->with('savedQuery:id,name,query_text,search_mode')
            ->orderBy('created_at', 'desc')
            ->paginate($perPage);

        return $this->paginatedResponse($runs);
    }

    /**
     * Get a specific search run with hits (API-6).
     */
    public function getSearchRun(Request $request, int $projectId, int $runId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $queryIds = SavedQuery::where('owner_type', 'project')
            ->where('owner_id', $projectId)
            ->pluck('id');

        $run = SearchRun::whereIn('saved_query_id', $queryIds)
            ->with('savedQuery')
            ->find($runId);

        if (!$run) {
            return $this->errorResponse('Search run not found.', 'NOT_FOUND', 404);
        }

        return $this->successResponse($run);
    }

    /**
     * Cancel an in-progress search run (API-6 / C-15).
     */
    public function cancelSearchRun(Request $request, int $projectId, int $runId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $queryIds = SavedQuery::where('owner_type', 'project')
            ->where('owner_id', $projectId)
            ->pluck('id');

        $run = SearchRun::whereIn('saved_query_id', $queryIds)->findOrFail($runId);
        $run->update(['status' => 'cancelled']);

        return $this->successResponse($run, 'Search run cancelled.');
    }

    /**
     * Retry a search run (API-6).
     */
    public function retrySearchRun(Request $request, int $projectId, int $runId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $run = SearchRun::with('savedQuery')->findOrFail($runId);
        return $this->run($request, $projectId, $run->saved_query_id);
    }

    /**
     * Compare two search runs (API-6 / SEA-09).
     */
    public function compareRuns(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        if ($request->has('ids_1') && $request->has('ids_2')) {
            $ids1 = (array) $request->input('ids_1', []);
            $ids2 = (array) $request->input('ids_2', []);

            $common = array_values(array_intersect($ids1, $ids2));
            $added = array_values(array_diff($ids2, $ids1));
            $removed = array_values(array_diff($ids1, $ids2));

            return $this->successResponse([
                'diff' => [
                    'added_count' => count($added),
                    'removed_count' => count($removed),
                    'retained_count' => count($common),
                    'added_ids' => $added,
                    'removed_ids' => $removed,
                    'retained_ids' => $common,
                ],
                'summary' => [
                    'common_count' => count($common),
                    'added_count' => count($added),
                    'removed_count' => count($removed),
                ],
                'added_hadith_ids' => $added,
                'removed_hadith_ids' => $removed,
                'common_hadith_ids' => $common,
            ]);
        }

        $validated = $request->validate([
            'run_id_1' => 'required|integer|exists:search_runs,id',
            'run_id_2' => 'required|integer|exists:search_runs,id',
        ]);

        $queryIds = SavedQuery::where('owner_type', 'project')
            ->where('owner_id', $projectId)
            ->pluck('id');

        $run1 = SearchRun::whereIn('saved_query_id', $queryIds)->findOrFail($validated['run_id_1']);
        $run2 = SearchRun::whereIn('saved_query_id', $queryIds)->findOrFail($validated['run_id_2']);

        $hits1 = collect($run1->hits ?? [])->pluck('hadith_id')->all();
        $hits2 = collect($run2->hits ?? [])->pluck('hadith_id')->all();

        $common = array_values(array_intersect($hits1, $hits2));
        $added = array_values(array_diff($hits2, $hits1));
        $removed = array_values(array_diff($hits1, $hits2));

        return $this->successResponse([
            'run_1' => [
                'id' => $run1->id,
                'match_count' => $run1->match_count,
                'created_at' => $run1->created_at,
            ],
            'run_2' => [
                'id' => $run2->id,
                'match_count' => $run2->match_count,
                'created_at' => $run2->created_at,
            ],
            'diff' => [
                'added_count' => count($added),
                'removed_count' => count($removed),
                'retained_count' => count($common),
                'added_ids' => $added,
                'removed_ids' => $removed,
                'retained_ids' => $common,
            ],
            'summary' => [
                'common_count' => count($common),
                'added_count' => count($added),
                'removed_count' => count($removed),
            ],
            'added_hadith_ids' => $added,
            'removed_hadith_ids' => $removed,
            'common_hadith_ids' => $common,
        ]);
    }

    // ------------------------------------------------------------------------
    // Personal Saved Searches (API-6 / SEA-04)
    // ------------------------------------------------------------------------

    public function listPersonalSavedSearches(Request $request): JsonResponse
    {
        $user = $request->user();
        $perPage = min((int)$request->input('per_page', 20), 100);

        $queries = SavedQuery::where('owner_type', 'user')
            ->where('owner_id', $user->id)
            ->latest('created_at')
            ->paginate($perPage);

        return $this->paginatedResponse($queries);
    }

    public function storePersonalSavedSearch(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'query_text' => 'required|string|min:2',
            'search_mode' => 'nullable|string|in:normalized,exact,fts',
            'filter_criteria' => 'nullable|array',
        ]);

        $query = SavedQuery::create([
            'owner_type' => 'user',
            'owner_id' => $user->id,
            'name' => $validated['name'],
            'query_text' => $validated['query_text'],
            'search_mode' => $validated['search_mode'] ?? 'normalized',
            'filter_criteria' => $validated['filter_criteria'] ?? [],
        ]);

        return $this->successResponse($query, 'Personal search query saved.', 201);
    }

    public function updatePersonalSavedSearch(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        $query = SavedQuery::where('owner_type', 'user')
            ->where('owner_id', $user->id)
            ->find($id);

        if (!$query) {
            return $this->errorResponse('Personal saved search not found.', 'NOT_FOUND', 404);
        }

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'query_text' => 'sometimes|required|string|min:2',
            'search_mode' => 'nullable|string|in:normalized,exact,fts',
            'filter_criteria' => 'nullable|array',
        ]);

        $query->update($validated);

        return $this->successResponse($query, 'Personal saved search updated.');
    }

    public function runPersonalSavedSearch(Request $request, int $id): JsonResponse
    {
        $query = SavedQuery::where('owner_type', 'user')
            ->where('owner_id', $request->user()->id)
            ->find($id);

        if (!$query) {
            return $this->errorResponse('Personal saved search not found.', 'NOT_FOUND', 404);
        }

        $result = app(\App\Services\SavedQueryRunner::class)->run($query, (int) $request->input('limit', 100));

        return $this->successResponse([
            'search_run' => $result['search_run'],
            'query' => $query,
            'matches' => $result['matches'],
            'truncated' => $result['truncated'],
            'total_available' => $result['total_available'],
        ], 'Search executed successfully.');
    }

    public function destroyPersonalSavedSearch(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        $query = SavedQuery::where('owner_type', 'user')
            ->where('owner_id', $user->id)
            ->find($id);

        if (!$query) {
            return $this->errorResponse('Personal saved search not found.', 'NOT_FOUND', 404);
        }

        $query->delete();

        return $this->successResponse(null, 'Personal saved search deleted.');
    }

    // ------------------------------------------------------------------------
    // Frozen Result Sets (API-6 / SEA-06)
    // ------------------------------------------------------------------------

    /**
     * List frozen result sets for project.
     */
    public function listResultSets(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $perPage = min((int)$request->input('per_page', 20), 100);
        $resultSets = ResultSet::where('project_id', $projectId)
            ->with(['searchRun'])
            ->latest('created_at')
            ->paginate($perPage);

        return $this->paginatedResponse($resultSets);
    }

    /**
     * Freeze an immutable snapshot of search results as a ResultSet.
     */
    public function storeResultSet(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'search_run_id' => 'nullable|integer|exists:search_runs,id',
            'select' => 'nullable|string|in:all,custom',
            'items' => 'required_without:search_run_id|array',
            'items.*.resource_type' => 'required_with:items|string',
            'items.*.corpus_id' => 'required_with:items|integer',
            'items.*.snapshot_data' => 'nullable|array',
        ]);

        $items = $validated['items'] ?? [];

        // Support select: "all" from search run (API-6)
        if (!empty($validated['search_run_id'])) {
            $queryIds = SavedQuery::where('owner_type', 'project')
                ->where('owner_id', $projectId)
                ->pluck('id');
            $run = SearchRun::whereIn('saved_query_id', $queryIds)->findOrFail($validated['search_run_id']);

            if (($validated['select'] ?? null) === 'all') {
                if ($run->status !== 'completed') {
                    return $this->errorResponse(
                        'Cannot freeze partial or failed search run results.',
                        'RUN_PARTIAL',
                        409
                    );
                }

                $items = collect($run->hits ?? [])->map(function ($h) {
                    return [
                        'resource_type' => 'hadith',
                        'corpus_id' => $h['hadith_id'],
                        'snapshot_data' => $h,
                    ];
                })->all();
            }
        }

        $resultSet = DB::transaction(function () use ($projectId, $validated, $items) {
            $set = ResultSet::create([
                'project_id' => $projectId,
                'search_run_id' => $validated['search_run_id'] ?? null,
                'name' => $validated['name'],
                'is_frozen' => true,
                'total_count' => count($items),
                'created_at' => now(),
            ]);

            foreach ($items as $index => $item) {
                ResultSetMember::create([
                    'result_set_id' => $set->id,
                    'resource_type' => $item['resource_type'],
                    'corpus_id' => $item['corpus_id'],
                    'ordinal_position' => $index + 1,
                    'snapshot_data' => $item['snapshot_data'] ?? [],
                    'created_at' => now(),
                ]);
            }

            return $set;
        });

        return $this->successResponse(
            $resultSet->load('members'),
            'Result set frozen and archived.',
            201
        );
    }

    /**
     * Retrieve single frozen result set and all its snapshot member items.
     */
    public function getResultSet(Request $request, int $projectId, int $setId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $resultSet = ResultSet::where('project_id', $projectId)
            ->with(['members', 'searchRun.savedQuery'])
            ->find($setId);

        if (!$resultSet) {
            return $this->errorResponse('Result set not found.', 'NOT_FOUND', 404);
        }

        return $this->successResponse($resultSet);
    }
}
