<?php

namespace App\Http\Controllers\Api;

use App\Models\Corpus\CorpusHadith;
use App\Models\Corpus\CorpusBook;
use App\Models\Corpus\CorpusNarrator;
use App\Models\Corpus\CorpusSanad;
use App\Models\Corpus\CorpusAlemQawlDetail;
use App\Models\Corpus\CorpusHadithCluster;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class CorpusController extends ApiController
{
    /**
     * Search the canonical Hadith corpus (Module 2).
     */
    public function search(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => 'nullable|string|max:255',
            'mode' => 'nullable|string|in:fts,trgm,normalized,exact',
            'book_id' => 'nullable|integer',
            'chapter_id' => 'nullable|integer',
            'hukm_id' => 'nullable|integer',
            'narrator_id' => 'nullable|integer',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        $query = CorpusHadith::query();

        if (!empty($validated['q'])) {
            $term = trim($validated['q']);
            $mode = $validated['mode'] ?? 'fts';

            if ($mode === 'exact') {
                $query->where('matn', 'LIKE', "%{$term}%");
            } elseif ($mode === 'trgm' || $mode === 'normalized') {
                $normalized = preg_replace('/[\x{064B}-\x{065F}\x{0670}]/u', '', $term);
                $normalized = str_replace(['أ', 'إ', 'آ'], 'ا', $normalized);
                $normalized = str_replace('ة', 'ه', $normalized);
                $normalized = str_replace('ى', 'ي', $normalized);
                $query->where('clean_matn', 'LIKE', "%{$normalized}%");
            } else {
                // High-performance Arabic Full-Text Search with GIN index & relevance ranking
                $query->whereRaw("to_tsvector('arabic', coalesce(clean_matn, '')) @@ plainto_tsquery('arabic', ?)", [$term])
                      ->orderByRaw("ts_rank(to_tsvector('arabic', coalesce(clean_matn, '')), plainto_tsquery('arabic', ?)) DESC", [$term]);
            }
        }

        if (!empty($validated['book_id'])) {
            $bookId = $validated['book_id'];
            $query->whereHas('references', function ($q) use ($bookId) {
                $q->where('book_id', $bookId);
            });
        }

        if (!empty($validated['chapter_id'])) {
            $chapterId = $validated['chapter_id'];
            $query->whereHas('references', function ($q) use ($chapterId) {
                $q->where('chapter_id', $chapterId);
            });
        }

        if (!empty($validated['hukm_id'])) {
            $hukmId = $validated['hukm_id'];
            $query->whereHas('references', function ($q) use ($hukmId) {
                $q->where('hukm_id', $hukmId);
            });
        }

        if (!empty($validated['narrator_id'])) {
            $narratorId = $validated['narrator_id'];
            $query->whereHas('references.sanads.narratorNodes', function ($q) use ($narratorId) {
                $q->where('narrator_id', $narratorId);
            });
        }

        $perPage = min((int) ($request->input('per_page', 20)), 100);

        $results = $query->with([
            'references' => function ($refQuery) {
                $refQuery->with(['book.author', 'chapter', 'hukm'])->limit(5);
            }
        ])->paginate($perPage);

        return $this->paginatedResponse($results);
    }

    /**
     * Get a specific Hadith with its full references, chapter hierarchy, and sanad chains.
     */
    public function getHadith(int $id): JsonResponse
    {
        $hadith = CorpusHadith::with([
            'references.book.author',
            'references.chapter',
            'references.section',
            'references.hukm',
            'references.sanads.narratorNodes.narrator',
            'references.sanads.narratorNodes.toldBy',
            'references.sanads.narratorNodes.connectorVariant',
        ])->find($id);

        if (!$hadith) {
            return $this->errorResponse('Hadith not found in canonical corpus.', 404);
        }

        return $this->successResponse($hadith);
    }

    /**
     * Get occurrences / clusters (mutaba'at & shawahid) for a Hadith.
     */
    public function getHadithOccurrences(int $id): JsonResponse
    {
        $hadith = CorpusHadith::find($id);
        if (!$hadith) {
            return $this->errorResponse('Hadith not found.', 404);
        }

        $clusters = CorpusHadithCluster::where('hadith_id', $id)
            ->orWhere('related_hadith_id', $id)
            ->with([
                'hadith.references.book',
                'relatedHadith.references.book',
            ])
            ->limit(50)
            ->get();

        return $this->successResponse([
            'hadith_id' => $id,
            'clusters_count' => $clusters->count(),
            'clusters' => $clusters,
        ]);
    }

    /**
     * Get narrator profile with statistics.
     */
    public function getNarrator(int $id): JsonResponse
    {
        $narrator = CorpusNarrator::withCount([
            'shyookh',
            'students',
            'transmissions',
            'criticisms',
        ])->find($id);

        if (!$narrator) {
            return $this->errorResponse('Narrator not found.', 404);
        }

        return $this->successResponse($narrator);
    }

    /**
     * Get Jarh wa Ta'dil scholarly criticisms for a narrator.
     */
    public function getNarratorCriticism(int $id, Request $request): JsonResponse
    {
        $narrator = CorpusNarrator::find($id);
        if (!$narrator) {
            return $this->errorResponse('Narrator not found.', 404);
        }

        $perPage = min((int) ($request->input('per_page', 20)), 100);

        $criticisms = CorpusAlemQawlDetail::where('narrator_id', $id)
            ->with(['scholar', 'book', 'hukm'])
            ->paginate($perPage);

        return $this->paginatedResponse($criticisms);
    }

    /**
     * Get teachers (shyookh) of a narrator.
     */
    public function getNarratorTeachers(int $id, Request $request): JsonResponse
    {
        $narrator = CorpusNarrator::find($id);
        if (!$narrator) {
            return $this->errorResponse('Narrator not found.', 404);
        }

        $perPage = min((int) ($request->input('per_page', 20)), 100);
        $teachers = $narrator->shyookh()->paginate($perPage);

        return $this->paginatedResponse($teachers);
    }

    /**
     * Get students of a narrator.
     */
    public function getNarratorStudents(int $id, Request $request): JsonResponse
    {
        $narrator = CorpusNarrator::find($id);
        if (!$narrator) {
            return $this->errorResponse('Narrator not found.', 404);
        }

        $perPage = min((int) ($request->input('per_page', 20)), 100);
        $students = $narrator->students()->paginate($perPage);

        return $this->paginatedResponse($students);
    }

    /**
     * List all books in the corpus.
     */
    public function getBooks(Request $request): JsonResponse
    {
        $perPage = min((int) ($request->input('per_page', 20)), 100);

        $books = CorpusBook::with('author')
            ->withCount('references')
            ->paginate($perPage);

        return $this->paginatedResponse($books);
    }

    /**
     * Get book details and its chapter outline.
     */
    public function getBook(int $id): JsonResponse
    {
        $book = CorpusBook::with(['author', 'chapters.sections'])->find($id);

        if (!$book) {
            return $this->errorResponse('Book not found.', 404);
        }

        return $this->successResponse($book);
    }

    /**
     * Get a specific Sanad chain with ordered narrator nodes and connectors.
     */
    public function getSanad(int $id): JsonResponse
    {
        $sanad = CorpusSanad::with([
            'reference.book',
            'reference.hadith',
            'narratorNodes.narrator',
            'narratorNodes.toldBy',
            'narratorNodes.connectorVariant',
        ])->find($id);

        if (!$sanad) {
            return $this->errorResponse('Sanad not found.', 404);
        }

        return $this->successResponse($sanad);
    }
}
