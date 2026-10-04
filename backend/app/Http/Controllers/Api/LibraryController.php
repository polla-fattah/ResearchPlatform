<?php

namespace App\Http\Controllers\Api;

use App\Models\LibraryItem;
use App\Models\Resource;
use App\Models\ResourceCollection;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class LibraryController extends ApiController
{
    /**
     * List user's personal library items (Module 3).
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

        if ($request->filled('q')) {
            $term = $request->input('q');
            $query->where(function ($q) use ($term) {
                $q->where('personal_notes', 'ILIKE', "%{$term}%")
                  ->orWhereHas('resource', fn($rq) => $rq->where('title', 'ILIKE', "%{$term}%"));
            });
        }

        $perPage = min((int) ($request->input('per_page', 20)), 100);
        $items = $query->latest('updated_at')->paginate($perPage);

        return $this->paginatedResponse($items);
    }

    /**
     * Add a resource to user's library.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'resource_id' => 'nullable|integer|exists:resources,id',
            'resource_type' => 'required_without:resource_id|string|max:50',
            'corpus_table' => 'nullable|string|max:50',
            'corpus_id' => 'nullable|integer',
            'title' => 'required_without:resource_id|string|max:1000',
            'author' => 'nullable|string|max:500',
            'source_metadata' => 'nullable|array',
            'personal_notes' => 'nullable|string',
            'is_favourite' => 'nullable|boolean',
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

        $libraryItem = LibraryItem::updateOrCreate(
            [
                'user_id' => $user->id,
                'resource_id' => $resource->id,
            ],
            [
                'is_favourite' => $validated['is_favourite'] ?? false,
                'personal_notes' => $validated['personal_notes'] ?? null,
            ]
        );

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
     * Update notes or favourite state.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        $item = LibraryItem::where('user_id', $user->id)->find($id);
        if (!$item) {
            return $this->errorResponse('Library item not found.', 'NOT_FOUND', 404);
        }

        $validated = $request->validate([
            'personal_notes' => 'nullable|string',
            'is_favourite' => 'nullable|boolean',
        ]);

        $item->update($validated);

        return $this->successResponse($item->load('resource'), 'Library item updated.');
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
}
