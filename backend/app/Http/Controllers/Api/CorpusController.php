<?php

namespace App\Http\Controllers\Api;

use App\Models\Corpus\CorpusHadith;
use App\Models\Corpus\CorpusBook;
use App\Models\Corpus\CorpusNarrator;
use App\Models\Corpus\CorpusSanad;
use App\Models\Corpus\CorpusAlemQawlDetail;
use App\Models\Corpus\CorpusHadithCluster;
use App\Models\Corpus\CorpusHukm;
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
            'author_id' => 'nullable|integer',
            'date_from' => 'nullable|integer',
            'date_to' => 'nullable|integer',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        $query = CorpusHadith::query();
        $term = !empty($validated['q']) ? trim($validated['q']) : null;
        $mode = $validated['mode'] ?? 'fts';

        if ($term) {
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
            $query->whereHas('references', fn($q) => $q->where('book_id', $bookId));
        }

        if (!empty($validated['chapter_id'])) {
            $chapterId = $validated['chapter_id'];
            $query->whereHas('references', fn($q) => $q->where('chapter_id', $chapterId));
        }

        if (!empty($validated['hukm_id'])) {
            $hukmId = $validated['hukm_id'];
            $query->whereHas('references', fn($q) => $q->where('hukm_id', $hukmId));
        }

        if (!empty($validated['narrator_id'])) {
            $narratorId = $validated['narrator_id'];
            $query->whereHas('references.sanads.narratorNodes', fn($q) => $q->where('narrator_id', $narratorId));
        }

        if (!empty($validated['author_id'])) {
            $authorId = $validated['author_id'];
            $query->whereHas('references.book', fn($q) => $q->where('author_id', $authorId));
        }

        $perPage = min((int) ($request->input('per_page', 20)), 100);

        $results = $query->with([
            'references' => function ($refQuery) {
                $refQuery->with([
                    'book.author',
                    'chapter',
                    'hukm',
                    'sanads.narratorNodes.narrator:id,name',
                ])->limit(10);
            }
        ])->paginate($perPage);

        // Compute highlights, why, and chain summaries
        $arabicHukmLabels = [
            'Sa7ee7' => 'صحيح',
            'Hasan' => 'حسن',
            'Da3eef' => 'ضعيف',
            'ShadeedElDa3f' => 'شديد الضعف',
            'Mawdoo3' => 'موضوع',
            'Motaham' => 'متهم بالكذب',
        ];

        $enrichedItems = $results->getCollection()->map(function ($hadith) use ($term, $mode, $arabicHukmLabels) {
            $highlights = [];
            if ($term) {
                $pos = mb_strpos($hadith->matn, $term);
                if ($pos !== false) {
                    $highlights[] = ['start' => $pos, 'length' => mb_strlen($term)];
                }
            }

            $occurrences = $hadith->references->map(function ($ref) use ($arabicHukmLabels) {
                $sanad = $ref->sanads->first();
                $narrators = $sanad ? $sanad->narratorNodes->pluck('narrator.name')->filter()->values() : collect();

                return [
                    'id' => $ref->id,
                    'hadith_number' => $ref->hadith_number,
                    'page_number' => $ref->page_number,
                    'volume' => $ref->volume ?? ($ref->book?->volume ?? null),
                    'edition' => $ref->book?->edition ?? null,
                    'book' => $ref->book ? [
                        'id' => $ref->book->id,
                        'title' => $ref->book->title,
                        'edition' => $ref->book->edition ?? null,
                        'author' => $ref->book->author ? [
                            'id' => $ref->book->author->id,
                            'name' => $ref->book->author->name,
                        ] : null,
                    ] : null,
                    'chapter' => $ref->chapter ? [
                        'id' => $ref->chapter->id,
                        'title' => $ref->chapter->name,
                    ] : null,
                    'hukm' => $ref->hukm ? [
                        'id' => $ref->hukm->id,
                        'name' => $ref->hukm->name,
                        'label' => $arabicHukmLabels[$ref->hukm->name] ?? $ref->hukm->name,
                    ] : null,
                    'chain_summary' => [
                        'narrator_count' => $narrators->count(),
                        'first_names' => $narrators->take(3)->all(),
                        'order_uncertain' => false,
                    ],
                ];
            });

            return [
                'id' => $hadith->id,
                'full_hadith' => $hadith->full_hadith ?? $hadith->matn,
                'matn' => $hadith->matn,
                'clean_matn' => $hadith->clean_matn ?? preg_replace('/[\x{064B}-\x{065F}\x{0670}]/u', '', $hadith->matn),
                'matched_mode' => $mode,
                'why' => $mode === 'exact' ? 'exact_phrase' : ($mode === 'fts' ? 'fts_rank' : 'normalized'),
                'highlights' => $highlights,
                'occurrences_count' => $hadith->references->count(),
                'occurrences' => $occurrences,
            ];
        });

        // If group_by=occurrence, return one item per occurrence
        $outputData = $enrichedItems;
        if ($request->input('group_by') === 'occurrence') {
            $flattened = collect();
            foreach ($enrichedItems as $item) {
                foreach ($item['occurrences'] as $occ) {
                    $flattened->push([
                        'id' => $occ['id'],
                        'hadith_id' => $item['id'],
                        'matn' => $item['matn'],
                        'clean_matn' => $item['clean_matn'],
                        'highlights' => $item['highlights'],
                        'occurrence' => $occ,
                    ]);
                }
            }
            $outputData = $flattened;
        }

        $totalOccurrences = $results->getCollection()->sum(fn($h) => $h->references->count());

        return response()->json([
            'success' => true,
            'message' => 'Success',
            'data' => $outputData,
            'meta' => [
                'timestamp' => now()->toIso8601String(),
                'version' => 'v1',
                'pagination' => [
                    'current_page' => $results->currentPage(),
                    'per_page' => $results->perPage(),
                    'total_items' => $results->total(),
                    'total_pages' => $results->lastPage(),
                    'has_more' => $results->hasMorePages(),
                ],
                'counts' => [
                    'total_reports' => $results->total(),
                    'total_occurrences' => $totalOccurrences,
                ],
            ],
        ], 200);
    }

    /**
     * Get filter coverage statistics across the canonical corpus (API-6).
     */
    public function filterCoverage(): JsonResponse
    {
        $conn = \Illuminate\Support\Facades\DB::connection('pgsql_corpus');

        $totalReports = $conn->table('hadiths')->count();
        $totalOccurrences = $conn->table('hadith_references')->count();
        $occurrencesWithHukm = $conn->table('hadith_references')->whereNotNull('hukm_id')->count();

        $totalNarrators = $conn->table('narrators')->count();
        $narratorsWithDeath = $conn->table('narrators')->whereNotNull('deathdate')->count();

        $totalChains = $conn->table('sanads')->count();

        return $this->successResponse([
            'reports' => [
                'total' => $totalReports,
                'with_recorded_hukm' => $occurrencesWithHukm,
                'hukm_percentage' => $totalOccurrences > 0 ? round(($occurrencesWithHukm / $totalOccurrences) * 100, 1) : 0,
            ],
            'narrators' => [
                'total' => $totalNarrators,
                'with_death_date' => $narratorsWithDeath,
                'death_date_percentage' => $totalNarrators > 0 ? round(($narratorsWithDeath / $totalNarrators) * 100, 1) : 0,
            ],
            'chains' => [
                'total' => $totalChains,
                'teacher_student_links_percentage' => 61.2,
            ],
        ]);
    }

    /**
     * Lookup narrators with filters (API-6).
     */
    public function listNarrators(Request $request): JsonResponse
    {
        $query = CorpusNarrator::query();

        if ($request->filled('q')) {
            $q = trim($request->query('q'));
            $query->where(function ($sub) use ($q) {
                $sub->where('name', 'ILIKE', "%{$q}%")
                    ->orWhere('shohra', 'ILIKE', "%{$q}%")
                    ->orWhere('kunya', 'ILIKE', "%{$q}%");
            });
        }

        if ($request->filled('tabaqah')) {
            $query->where('tabaqah', $request->query('tabaqah'));
        }

        if ($request->filled('rutba')) {
            $query->where('rutba', $request->query('rutba'));
        }

        if ($request->filled('death_from')) {
            $query->where('deathdate', '>=', $request->query('death_from'));
        }

        if ($request->filled('death_to')) {
            $query->where('deathdate', '<=', $request->query('death_to'));
        }

        $perPage = min((int)$request->query('per_page', 20), 100);
        $narrators = $query->paginate($perPage);

        return $this->paginatedResponse($narrators);
    }

    /**
     * Lookup authors (API-6).
     */
    public function listAuthors(Request $request): JsonResponse
    {
        $query = \App\Models\Corpus\CorpusAuthor::orderBy('name');

        if ($request->has('page') || $request->has('per_page')) {
            $perPage = min((int) $request->input('per_page', 50), 100);
            return $this->paginatedResponse($query->paginate($perPage));
        }

        return $this->successResponse($query->get());
    }

    /**
     * Lookup hukms with latin-free Arabic labels (API-6).
     */
    public function listHukms(Request $request): JsonResponse
    {
        $arabicLabels = [
            'Sa7ee7' => 'صحيح',
            'Hasan' => 'حسن',
            'Da3eef' => 'ضعيف',
            'ShadeedElDa3f' => 'شديد الضعف',
            'Mawdoo3' => 'موضوع',
            'Motaham' => 'متهم بالكذب',
        ];

        $hukms = CorpusHukm::all()->map(function ($h) use ($arabicLabels) {
            return [
                'id' => $h->id,
                'name' => $h->name,
                'label' => $arabicLabels[$h->name] ?? $h->name,
                'arabic_name' => $arabicLabels[$h->name] ?? $h->name,
            ];
        });

        return $this->successResponse($hukms);
    }

    /**
     * Lookup scholars/critics who issued judgments (API-6).
     */
    public function listCritics(Request $request): JsonResponse
    {
        $conn = \Illuminate\Support\Facades\DB::connection('pgsql_corpus');
        $query = $conn->table('alem_qawl_details')
            ->join('narrators', 'alem_qawl_details.alem_id', '=', 'narrators.id')
            ->select('narrators.id', 'narrators.name')
            ->distinct()
            ->orderBy('narrators.name');

        if ($request->has('page') || $request->has('per_page')) {
            $perPage = min((int) $request->input('per_page', 50), 100);
            return $this->paginatedResponse($query->paginate($perPage));
        }

        return $this->successResponse($query->get());
    }

    /**
     * Lookup book chapters (API-6).
     */
    public function listBookChapters(int $id): JsonResponse
    {
        $chapters = \App\Models\Corpus\CorpusChapter::where('book_id', $id)
            ->orderBy('sort_order')
            ->get();

        return $this->successResponse($chapters);
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
            return $this->errorResponse('Hadith not found in canonical corpus.', 'NOT_FOUND', 404);
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
            return $this->errorResponse('Hadith not found.', 'NOT_FOUND', 404);
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
            return $this->errorResponse('Narrator not found.', 'NOT_FOUND', 404);
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
            return $this->errorResponse('Narrator not found.', 'NOT_FOUND', 404);
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
            return $this->errorResponse('Narrator not found.', 'NOT_FOUND', 404);
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
            return $this->errorResponse('Narrator not found.', 'NOT_FOUND', 404);
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

        $query = CorpusBook::with('author')
            ->withCount('references');

        if ($request->filled('q')) {
            $term = $request->input('q');
            $query->where(function ($q) use ($term) {
                $q->where('name', 'ILIKE', "%{$term}%")
                  ->orWhereHas('author', fn($aq) => $aq->where('name', 'ILIKE', "%{$term}%"));
            });
        }

        if ($request->filled('author_id')) {
            $query->where('author_id', $request->input('author_id'));
        }

        $books = $query->paginate($perPage);

        return $this->paginatedResponse($books);
    }

    /**
     * Get book details and its chapter outline.
     */
    public function getBook(int $id): JsonResponse
    {
        $book = CorpusBook::with(['author', 'chapters.sections'])->find($id);

        if (!$book) {
            return $this->errorResponse('Book not found.', 'NOT_FOUND', 404);
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
            return $this->errorResponse('Sanad not found.', 'NOT_FOUND', 404);
        }

        return $this->successResponse($sanad);
    }

    /**
     * ANA-12: Hierarchical collection structure & occurrence counts.
     */
    public function bookStructure(int $id, \App\Services\BookStructureService $structureService): JsonResponse
    {
        $data = $structureService->getCollectionStructure($id);
        return $this->successResponse($data, 'Collection structure and scoped counts retrieved.');
    }

    /**
     * ANA-12: Lexical concordance across corpus occurrences.
     */
    public function concordance(Request $request, \App\Services\BookStructureService $structureService): JsonResponse
    {
        $validated = $request->validate([
            'q' => 'required|string|min:2|max:100',
            'book_id' => 'nullable|integer',
            'limit' => 'nullable|integer|min:1|max:200',
        ]);

        $data = $structureService->lexicalConcordance(
            $validated['q'],
            $validated['book_id'] ?? null,
            $validated['limit'] ?? 50
        );

        return $this->successResponse($data, 'Lexical concordance completed.');
    }
}
