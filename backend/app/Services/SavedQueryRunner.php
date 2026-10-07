<?php

namespace App\Services;

use App\Models\Corpus\CorpusHadith;
use App\Models\SavedQuery;
use App\Models\SearchRun;

class SavedQueryRunner
{
    /**
     * Run a saved query against the corpus and record the run.
     *
     * @return array{search_run: SearchRun, matches: \Illuminate\Support\Collection, truncated: bool, total_available: int}
     */
    public function run(SavedQuery $query, int $limit = 100): array
    {
        $startTime = microtime(true);

        $queryText = trim($query->query_text);
        $mode = $query->search_mode ?? 'normalized';
        $filters = $query->filter_criteria ?? [];

        $corpusQuery = CorpusHadith::query();

        if ($mode === 'exact') {
            $corpusQuery->where('matn', 'LIKE', "%{$queryText}%");
        } elseif ($mode === 'fts') {
            $corpusQuery->whereRaw("to_tsvector('arabic', coalesce(clean_matn, '')) @@ plainto_tsquery('arabic', ?)", [$queryText])
                ->orderByRaw("ts_rank(to_tsvector('arabic', coalesce(clean_matn, '')), plainto_tsquery('arabic', ?)) DESC", [$queryText]);
        } else {
            // Normalized search
            $normalized = preg_replace('/[\x{064B}-\x{065F}\x{0670}]/u', '', $queryText);
            $normalized = str_replace(['أ', 'إ', 'آ'], 'ا', $normalized);
            $normalized = str_replace('ة', 'ه', $normalized);
            $normalized = str_replace('ى', 'ي', $normalized);
            $corpusQuery->where('clean_matn', 'LIKE', "%{$normalized}%");
        }

        // Apply saved filter_criteria (DEF-11)
        if (!empty($filters['book_id'])) {
            $bookId = $filters['book_id'];
            $corpusQuery->whereHas('references', fn($q) => $q->where('book_id', $bookId));
        }

        if (!empty($filters['chapter_id'])) {
            $chapterId = $filters['chapter_id'];
            $corpusQuery->whereHas('references', fn($q) => $q->where('chapter_id', $chapterId));
        }

        if (!empty($filters['hukm_id'])) {
            $hukmId = $filters['hukm_id'];
            $corpusQuery->whereHas('references', fn($q) => $q->where('hukm_id', $hukmId));
        }

        if (!empty($filters['narrator_id'])) {
            $narratorId = $filters['narrator_id'];
            $corpusQuery->whereHas('references.sanads.narratorNodes', fn($q) => $q->where('narrator_id', $narratorId));
        }

        if (!empty($filters['author_id'])) {
            $authorId = $filters['author_id'];
            $corpusQuery->whereHas('references.book', fn($q) => $q->where('author_id', $authorId));
        }

        $limit = min($limit, 500);
        $totalAvailable = (clone $corpusQuery)->count();
        $matches = $corpusQuery->select(['id', 'matn', 'clean_matn'])
            ->limit($limit)
            ->get();

        $isTruncated = $totalAvailable > $matches->count();
        $durationMs = (int) round((microtime(true) - $startTime) * 1000);

        $hitsData = $matches->map(function ($item, $idx) {
            return [
                'ordinal' => $idx + 1,
                'hadith_id' => $item->id,
                'snippet' => mb_substr($item->matn, 0, 150),
            ];
        })->all();

        $searchRun = SearchRun::create([
            'saved_query_id' => $query->id,
            'corpus_version' => 'hadiths_v2.0',
            'query_version' => 1,
            'index_id' => 'idx_corpus_fts',
            'match_count' => $matches->count(),
            'status' => 'completed',
            'progress' => [
                'scanned_books' => 6,
                'total_books' => 6,
                'truncated' => $isTruncated,
                'total_available' => $totalAvailable,
            ],
            'hits' => $hitsData,
            'execution_duration_ms' => $durationMs,
            'created_at' => now(),
        ]);

        return [
            'search_run' => $searchRun,
            'matches' => $matches,
            'truncated' => $isTruncated,
            'total_available' => $totalAvailable,
        ];
    }
}
