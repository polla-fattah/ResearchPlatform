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

        $queries = SavedQuery::where('owner_type', 'project')
            ->where('owner_id', $projectId)
            ->with(['searchRuns' => fn($q) => $q->latest('created_at')->limit(5)])
            ->latest('created_at')
            ->get();

        return $this->successResponse($queries);
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
     * Execute a saved search query against the corpus and record a search_run.
     */
    public function run(Request $request, int $projectId, int $queryId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $query = SavedQuery::where('owner_type', 'project')
            ->where('owner_id', $projectId)
            ->findOrFail($queryId);

        $startTime = microtime(true);

        $queryText = trim($query->query_text);
        $mode = $query->search_mode ?? 'normalized';

        $corpusQuery = CorpusHadith::query();

        if ($mode === 'exact') {
            $corpusQuery->where('matn', 'LIKE', "%{$queryText}%");
        } elseif ($mode === 'fts') {
            $corpusQuery->whereRaw("to_tsvector('arabic', coalesce(clean_matn, '')) @@ plainto_tsquery('arabic', ?)", [$queryText])
                ->orderByRaw("ts_rank(to_tsvector('arabic', coalesce(clean_matn, '')), plainto_tsquery('arabic', ?)) DESC", [$queryText]);
        } else {
            // Normalized search with trigram index
            $normalized = preg_replace('/[\x{064B}-\x{065F}\x{0670}]/u', '', $queryText);
            $normalized = str_replace(['أ', 'إ', 'آ'], 'ا', $normalized);
            $normalized = str_replace('ة', 'ه', $normalized);
            $normalized = str_replace('ى', 'ي', $normalized);

            $corpusQuery->where('clean_matn', 'LIKE', "%{$normalized}%");
        }

        $limit = min((int) ($request->input('limit', 50)), 200);
        $matches = $corpusQuery->select(['id', 'matn', 'clean_matn'])
            ->limit($limit)
            ->get();

        $durationMs = (int) round((microtime(true) - $startTime) * 1000);

        $searchRun = SearchRun::create([
            'saved_query_id' => $query->id,
            'corpus_version' => 'hadiths_v2.0',
            'match_count' => $matches->count(),
            'status' => 'completed',
            'execution_duration_ms' => $durationMs,
            'created_at' => now(),
        ]);

        return $this->successResponse([
            'search_run' => $searchRun,
            'query' => $query,
            'matches' => $matches,
        ], 'Search executed successfully.');
    }

    /**
     * List frozen result sets for project.
     */
    public function listResultSets(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $resultSets = ResultSet::where('project_id', $projectId)
            ->with(['searchRun'])
            ->latest('created_at')
            ->get();

        return $this->successResponse($resultSets);
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
            'search_run_id' => 'nullable|integer',
            'items' => 'required|array|min:1',
            'items.*.resource_type' => 'required|string',
            'items.*.corpus_id' => 'required|integer',
            'items.*.snapshot_data' => 'nullable|array',
        ]);

        $resultSet = DB::transaction(function () use ($projectId, $validated) {
            $set = ResultSet::create([
                'project_id' => $projectId,
                'search_run_id' => $validated['search_run_id'] ?? null,
                'name' => $validated['name'],
                'is_frozen' => true,
                'total_count' => count($validated['items']),
                'created_at' => now(),
            ]);

            foreach ($validated['items'] as $index => $item) {
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
            ->findOrFail($setId);

        return $this->successResponse($resultSet);
    }
}
