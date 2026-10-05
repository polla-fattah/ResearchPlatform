<?php

namespace App\Http\Controllers\Api;

use App\Models\LibraryItem;
use App\Models\Resource;
use App\Models\ResourceCollection;
use App\Models\ResearchProject;
use App\Models\ProjectResource;
use App\Models\ProjectActivity;
use App\Services\AuthPolicyService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class LibraryController extends ApiController
{
    public function __construct(
        protected AuthPolicyService $policyService
    ) {}

    /**
     * List user's personal library items with filters and scope counts.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = LibraryItem::with(['resource.collections'])
            ->where('user_id', $user->id);

        if ($request->has('is_favourite')) {
            $isFav = filter_var($request->input('is_favourite'), FILTER_VALIDATE_BOOLEAN);
            $query->where('is_favourite', $isFav);
        }

        if ($request->filled('resource_type')) {
            $type = $request->input('resource_type');
            $query->whereHas('resource', fn($q) => $q->where('resource_type', $type));
        }

        if ($request->filled('collection_id')) {
            $colId = $request->input('collection_id');
            $query->whereHas('resource.collections', fn($q) => $q->where('collection_id', $colId));
        }

        if ($request->filled('source_status')) {
            $query->where('source_status', $request->input('source_status'));
        }

        if ($request->filled('saved_from')) {
            $query->where('created_at', '>=', $request->input('saved_from'));
        }

        if ($request->filled('saved_to')) {
            $query->where('created_at', '<=', $request->input('saved_to'));
        }

        if ($request->filled('tag')) {
            $tag = $request->input('tag');
            $query->whereJsonContains('tags', $tag);
        }

        if ($request->filled('q')) {
            $term = $request->input('q');
            $query->where(function ($q) use ($term) {
                $q->where('personal_notes', 'ILIKE', "%{$term}%")
                  ->orWhere('excerpt_text', 'ILIKE', "%{$term}%")
                  ->orWhereHas('resource', fn($rq) => $rq->where('title', 'ILIKE', "%{$term}%")->orWhere('author', 'ILIKE', "%{$term}%"));
            });
        }

        $perPage = min((int) ($request->input('per_page', 20)), 100);
        $paginator = $query->latest('updated_at')->paginate($perPage);

        // Scope counts
        $totalSaved = LibraryItem::where('user_id', $user->id)->count();
        $favouritesCount = LibraryItem::where('user_id', $user->id)->where('is_favourite', true)->count();
        $collectionsCount = ResourceCollection::where('owner_type', 'user')->where('owner_id', $user->id)->count();

        return response()->json([
            'success' => true,
            'message' => 'Success',
            'data' => $paginator->items(),
            'meta' => [
                'timestamp' => now()->toIso8601String(),
                'version' => 'v1',
                'pagination' => [
                    'current_page' => $paginator->currentPage(),
                    'per_page' => $paginator->perPage(),
                    'total_items' => $paginator->total(),
                    'total_pages' => $paginator->lastPage(),
                    'has_more' => $paginator->hasMorePages(),
                ],
                'counts' => [
                    'total_saved' => $totalSaved,
                    'favourites_count' => $favouritesCount,
                    'collections_count' => $collectionsCount,
                ],
            ],
        ], 200);
    }

    /**
     * Add a resource to user's library with duplicate handling (DEF-9 / API-5).
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'resource_id' => 'nullable|integer|exists:resources,id',
            'resource_type' => 'required_without:resource_id|string|in:hadith,hadith_reference,narrator,book,alem_qawl_detail,sanad,external,corpus_hadith,corpus_narrator,corpus_book,manuscript,article',
            'corpus_table' => 'nullable|string|max:50',
            'corpus_id' => 'nullable|integer',
            'title' => 'required_without:resource_id|string|max:1000',
            'author' => 'nullable|string|max:500',
            'source_metadata' => 'nullable|array',
            'personal_notes' => 'nullable|string',
            'is_favourite' => 'nullable|boolean',
            'locator' => 'nullable|string|max:255',
            'excerpt_text' => 'nullable|string',
            'snapshot_data' => 'nullable|array',
            'snapshot_corpus_version' => 'nullable|string|max:50',
            'source_status' => 'nullable|string|in:current,changed,merged,removed',
            'merged_into' => 'nullable|string|max:255',
            'incomplete_citation_flags' => 'nullable|array',
            'tags' => 'nullable|array',
            'tags.*' => 'string|max:50',
            'notes' => 'nullable|array',
            'allow_duplicate_excerpt' => 'nullable|boolean',
        ]);

        if (!empty($validated['resource_id'])) {
            $resource = Resource::findOrFail($validated['resource_id']);
        } else {
            // Find existing or create shared resource
            $lookup = [
                'resource_type' => $validated['resource_type'],
            ];
            if (!empty($validated['corpus_table']) && !empty($validated['corpus_id'])) {
                $lookup['corpus_table'] = $validated['corpus_table'];
                $lookup['corpus_id'] = $validated['corpus_id'];
            } else {
                $lookup['title'] = $validated['title'];
            }

            $resource = Resource::firstOrCreate($lookup, [
                'title' => $validated['title'],
                'author' => $validated['author'] ?? null,
                'source_metadata' => $validated['source_metadata'] ?? [],
                'rights_status' => 'open',
            ]);
        }

        // DEF-9 Duplicate Detection
        $existingItem = LibraryItem::where('user_id', $user->id)
            ->where('resource_id', $resource->id)
            ->first();

        if ($existingItem && !$request->boolean('allow_duplicate_excerpt')) {
            return $this->errorResponse(
                'This resource is already saved in your library.',
                'DUPLICATE',
                409,
                ['existing_item' => $existingItem->load('resource')]
            );
        }

        $libraryItem = LibraryItem::create([
            'user_id' => $user->id,
            'resource_id' => $resource->id,
            'is_favourite' => $validated['is_favourite'] ?? false,
            'personal_notes' => $validated['personal_notes'] ?? null,
            'locator' => $validated['locator'] ?? null,
            'excerpt_text' => $validated['excerpt_text'] ?? null,
            'snapshot_data' => $validated['snapshot_data'] ?? null,
            'snapshot_corpus_version' => $validated['snapshot_corpus_version'] ?? 'v2026.09',
            'source_status' => $validated['source_status'] ?? 'current',
            'merged_into' => $validated['merged_into'] ?? null,
            'incomplete_citation_flags' => $validated['incomplete_citation_flags'] ?? [],
            'tags' => $validated['tags'] ?? [],
            'notes' => $validated['notes'] ?? [],
        ]);

        return $this->successResponse(
            $libraryItem->load('resource'),
            'Resource added to library.',
            201
        );
    }

    /**
     * View specific library item details.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        $item = LibraryItem::with(['resource.collections'])
            ->where('user_id', $user->id)
            ->find($id);

        if (!$item) {
            return $this->errorResponse('Library item not found.', 'NOT_FOUND', 404);
        }

        return $this->successResponse($item);
    }

    /**
     * Update item details without wiping unsent attributes (DEF-9).
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        $item = LibraryItem::where('user_id', $user->id)->find($id);
        if (!$item) {
            return $this->errorResponse('Library item not found.', 'NOT_FOUND', 404);
        }

        $validated = $request->validate([
            'personal_notes' => 'sometimes|nullable|string',
            'is_favourite' => 'sometimes|boolean',
            'locator' => 'sometimes|nullable|string|max:255',
            'excerpt_text' => 'sometimes|nullable|string',
            'snapshot_data' => 'sometimes|nullable|array',
            'snapshot_corpus_version' => 'sometimes|nullable|string|max:50',
            'source_status' => 'sometimes|string|in:current,changed,merged,removed',
            'merged_into' => 'sometimes|nullable|string|max:255',
            'incomplete_citation_flags' => 'sometimes|nullable|array',
            'tags' => 'sometimes|nullable|array',
            'tags.*' => 'string|max:50',
            'notes' => 'sometimes|nullable|array',
        ]);

        $item->update($validated);

        return $this->successResponse($item->fresh('resource'), 'Library item updated.');
    }

    /**
     * Remove item from personal library.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        $item = LibraryItem::where('user_id', $user->id)->find($id);
        if (!$item) {
            return $this->errorResponse('Library item not found.', 'NOT_FOUND', 404);
        }

        $item->delete();

        return $this->successResponse(null, 'Item removed from library.');
    }

    /**
     * Get distinct tags across user's library items (API-5).
     */
    public function tags(Request $request): JsonResponse
    {
        $user = $request->user();
        $items = LibraryItem::where('user_id', $user->id)->whereNotNull('tags')->pluck('tags');

        $tags = $items->flatten()->filter()->unique()->values()->all();

        return $this->successResponse($tags);
    }

    /**
     * Update tags on a library item.
     */
    public function updateTags(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        $item = LibraryItem::where('user_id', $user->id)->find($id);
        if (!$item) {
            return $this->errorResponse('Library item not found.', 'NOT_FOUND', 404);
        }

        $validated = $request->validate([
            'tags' => 'present|array',
            'tags.*' => 'string|max:50',
        ]);

        $item->update(['tags' => array_values(array_unique($validated['tags']))]);

        return $this->successResponse($item->fresh(), 'Tags updated successfully.');
    }

    /**
     * Preview sharing library item to projects (API-5 / LIB-05).
     */
    public function sharePreview(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        $item = LibraryItem::with('resource')->where('user_id', $user->id)->find($id);
        if (!$item) {
            return $this->errorResponse('Library item not found.', 'NOT_FOUND', 404);
        }

        $validated = $request->validate([
            'project_ids' => 'required|array|min:1',
            'project_ids.*' => 'integer|exists:research_projects,id',
            'share' => 'nullable|array',
            'share.excerpt' => 'nullable|boolean',
            'share.tags' => 'nullable|boolean',
            'share.notes' => 'nullable|boolean',
        ]);

        $shareOpts = $validated['share'] ?? [];
        $projects = ResearchProject::whereIn('id', $validated['project_ids'])->where('is_deleted', false)->get();

        $preview = $projects->map(function ($proj) use ($item, $shareOpts) {
            $alreadyExists = ProjectResource::where('project_id', $proj->id)
                ->where('resource_id', $item->resource_id)
                ->exists();

            return [
                'project_id' => $proj->id,
                'project_title' => $proj->title,
                'already_in_project' => $alreadyExists,
                'will_include' => [
                    'resource' => true,
                    'locator' => true,
                    'excerpt' => $shareOpts['excerpt'] ?? true,
                    'tags' => $shareOpts['tags'] ?? false,
                    'notes' => $shareOpts['notes'] ?? false, // Private notes off by default
                ],
            ];
        });

        return $this->successResponse($preview);
    }

    /**
     * Add library item to selected projects (API-5 / LIB-05).
     */
    public function addToProjects(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        $item = LibraryItem::with('resource')->where('user_id', $user->id)->find($id);
        if (!$item) {
            return $this->errorResponse('Library item not found.', 'NOT_FOUND', 404);
        }

        $validated = $request->validate([
            'project_ids' => 'required|array|min:1',
            'project_ids.*' => 'integer|exists:research_projects,id',
            'share' => 'nullable|array',
            'share.excerpt' => 'nullable|boolean',
            'share.tags' => 'nullable|boolean',
            'share.notes' => 'nullable|boolean',
        ]);

        $shareOpts = $validated['share'] ?? [];
        $results = [];

        foreach ($validated['project_ids'] as $projectId) {
            $project = ResearchProject::where('is_deleted', false)->find($projectId);
            if (!$project) {
                $results[] = ['project_id' => $projectId, 'status' => 'project_not_found'];
                continue;
            }

            try {
                $this->policyService->authorizeProject($user, 'add_resource', $project);
            } catch (\Exception $e) {
                $results[] = ['project_id' => $projectId, 'status' => 'forbidden'];
                continue;
            }

            $existing = ProjectResource::where('project_id', $project->id)
                ->where('resource_id', $item->resource_id)
                ->first();

            if ($existing) {
                $results[] = [
                    'project_id' => $project->id,
                    'status' => 'already_in_project',
                    'project_resource_id' => $existing->id,
                ];
                continue;
            }

            $tags = !empty($shareOpts['tags']) ? ($item->tags ?? []) : [];
            $notes = !empty($shareOpts['notes']) ? $item->personal_notes : null;

            $projRes = ProjectResource::create([
                'project_id' => $project->id,
                'resource_id' => $item->resource_id,
                'added_by' => $user->id,
                'inclusion_rationale' => $notes,
                'tags' => $tags,
                'origin' => [
                    'type' => 'library',
                    'ref' => "LIB-{$item->id}",
                    'at' => now()->toIso8601String(),
                ],
            ]);

            ProjectActivity::create([
                'project_id' => $project->id,
                'actor_id' => $user->id,
                'action' => 'resource_added',
                'object_type' => 'resource',
                'object_id' => $item->resource_id,
                'summary' => "Added resource '{$item->resource?->title}' from personal library",
                'created_at' => now(),
            ]);

            $results[] = [
                'project_id' => $project->id,
                'status' => 'added',
                'project_resource_id' => $projRes->id,
            ];
        }

        return $this->successResponse($results, 'Resource shared to projects.');
    }

    /**
     * List user collections / folders.
     */
    public function collections(Request $request): JsonResponse
    {
        $user = $request->user();

        $collections = ResourceCollection::where('owner_type', 'user')
            ->where('owner_id', $user->id)
            ->withCount('resources')
            ->orderBy('name')
            ->get();

        return $this->successResponse($collections);
    }

    /**
     * Create a new personal collection.
     */
    public function storeCollection(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
        ]);

        $collection = ResourceCollection::create([
            'owner_type' => 'user',
            'owner_id' => $user->id,
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
        ]);

        return $this->successResponse($collection, 'Collection created successfully.', 201);
    }

    /**
     * Update personal collection.
     */
    public function updateCollection(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        $collection = ResourceCollection::where('owner_type', 'user')
            ->where('owner_id', $user->id)
            ->find($id);

        if (!$collection) {
            return $this->errorResponse('Collection not found.', 'NOT_FOUND', 404);
        }

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'description' => 'sometimes|nullable|string',
        ]);

        $collection->update($validated);

        return $this->successResponse($collection, 'Collection updated successfully.');
    }

    /**
     * Delete personal collection.
     */
    public function destroyCollection(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        $collection = ResourceCollection::where('owner_type', 'user')
            ->where('owner_id', $user->id)
            ->find($id);

        if (!$collection) {
            return $this->errorResponse('Collection not found.', 'NOT_FOUND', 404);
        }

        $collection->delete();

        return $this->successResponse(null, 'Collection deleted.');
    }

    /**
     * Add a resource to a collection.
     */
    public function addToCollection(Request $request, int $collectionId): JsonResponse
    {
        $user = $request->user();

        $collection = ResourceCollection::where('owner_type', 'user')
            ->where('owner_id', $user->id)
            ->find($collectionId);

        if (!$collection) {
            return $this->errorResponse('Collection not found.', 'NOT_FOUND', 404);
        }

        $validated = $request->validate([
            'resource_id' => 'required|integer|exists:resources,id',
        ]);

        $collection->resources()->syncWithoutDetaching([$validated['resource_id']]);

        return $this->successResponse(null, 'Resource added to collection.');
    }

    /**
     * Remove a resource from a collection.
     */
    public function removeFromCollection(Request $request, int $collectionId, int $resourceId): JsonResponse
    {
        $user = $request->user();

        $collection = ResourceCollection::where('owner_type', 'user')
            ->where('owner_id', $user->id)
            ->find($collectionId);

        if (!$collection) {
            return $this->errorResponse('Collection not found.', 'NOT_FOUND', 404);
        }

        $collection->resources()->detach($resourceId);

        return $this->successResponse(null, 'Resource removed from collection.');
    }

    // ------------------------------------------------------------------------
    // Project Resource Collections (API-5 / LIB-06)
    // ------------------------------------------------------------------------

    public function listProjectCollections(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $cols = DB::table('project_resource_collections')
            ->where('project_id', $project->id)
            ->get();

        $colIds = $cols->pluck('id')->all();
        $counts = DB::table('project_resource_collection_items')
            ->whereIn('collection_id', $colIds)
            ->selectRaw('collection_id, count(*) as count')
            ->groupBy('collection_id')
            ->pluck('count', 'collection_id');

        $result = $cols->map(function ($c) use ($counts) {
            return [
                'id' => $c->id,
                'project_id' => $c->project_id,
                'name' => $c->name,
                'description' => $c->description,
                'items_count' => $counts[$c->id] ?? 0,
                'created_at' => $c->created_at,
            ];
        });

        return $this->successResponse($result);
    }

    public function storeProjectCollection(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
        ]);

        $id = DB::table('project_resource_collections')->insertGetId([
            'project_id' => $project->id,
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $this->successResponse([
            'id' => $id,
            'project_id' => $project->id,
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
        ], 'Project resource collection created.', 201);
    }

    public function addItemToProjectCollection(Request $request, int $projectId, int $collectionId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $col = DB::table('project_resource_collections')
            ->where('project_id', $project->id)
            ->where('id', $collectionId)
            ->first();

        if (!$col) {
            return $this->errorResponse('Project collection not found.', 'NOT_FOUND', 404);
        }

        $validated = $request->validate([
            'resource_id' => 'required|integer|exists:resources,id',
        ]);

        DB::table('project_resource_collection_items')->updateOrInsert(
            ['collection_id' => $col->id, 'resource_id' => $validated['resource_id']],
            ['created_at' => now(), 'updated_at' => now()]
        );

        return $this->successResponse(null, 'Resource added to project collection.');
    }

    public function removeItemFromProjectCollection(Request $request, int $projectId, int $collectionId, int $resourceId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        DB::table('project_resource_collection_items')
            ->where('collection_id', $collectionId)
            ->where('resource_id', $resourceId)
            ->delete();

        return $this->successResponse(null, 'Resource removed from project collection.');
    }

    public function destroyProjectCollection(Request $request, int $projectId, int $collectionId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        DB::table('project_resource_collections')
            ->where('project_id', $project->id)
            ->where('id', $collectionId)
            ->delete();

        return $this->successResponse(null, 'Project resource collection deleted.');
    }
}
