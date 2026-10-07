<?php

namespace App\Services;

use App\Models\Corpus\CorpusBook;
use App\Models\Corpus\CorpusChapter;
use App\Models\Corpus\CorpusHadithReference;
use App\Models\Corpus\CorpusHadith;
use Illuminate\Support\Facades\DB;

class BookStructureService
{
    /** The most places the concordance counts; above this it says "at least". */
    private const COUNT_CAP = 10000;

    /**
     * Retrieve the hierarchical table of contents and scoped occurrence counts.
     */
    public function getCollectionStructure(int $bookId): array
    {
        $book = CorpusBook::findOrFail($bookId);
        $bookTitle = $book->title ?? "Book #{$bookId}";
        $author = $book->author ?? null;

        // Fetch chapters belonging to this book
        $chapters = CorpusChapter::where('book_id', $bookId)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        $structure = [];
        $totalOccurrences = 0;

        foreach ($chapters as $chapter) {
            $occurrenceCount = CorpusHadithReference::where('chapter_id', $chapter->id)->count();
            $totalOccurrences += $occurrenceCount;

            $structure[] = [
                'chapter_id' => $chapter->id,
                'chapter_title' => $chapter->name ?? "Chapter #{$chapter->id}",
                'chapter_number' => $chapter->sort_order,
                'occurrence_count' => $occurrenceCount,
            ];
        }

        return [
            'book_id' => $bookId,
            'book_title' => $bookTitle,
            'author' => $author,
            'total_chapters' => count($structure),
            'total_occurrences' => $totalOccurrences,
            'chapters' => $structure,
        ];
    }

    /**
     * Lexical concordance across corpus occurrences for a given Arabic root or stem.
     */
    public function lexicalConcordance(string $queryTerm, ?int $bookId = null, int $limit = 50): array
    {
        $normalizedTerm = $this->normalizeArabic($queryTerm);
        // The term is searched as written: a % or _ in it is the character, not a wildcard.
        $pattern = '%' . addcslashes($normalizedTerm, '\\%_') . '%';

        $query = CorpusHadithReference::query()
            ->with(['book', 'chapter', 'hadith']);

        if ($bookId) {
            $query->where('book_id', $bookId);
        }

        // Search text occurrences via related hadith
        $query->whereHas('hadith', function ($q) use ($pattern) {
            $q->where('clean_matn', 'ILIKE', $pattern)
              ->orWhere('matn', 'ILIKE', $pattern);
        });

        // A term the text indexes cannot serve (under three characters, or one that matches almost nothing) can mean a
        // scan of the whole corpus, so the search is cut off after a few seconds and says so.
        $connection = DB::connection('pgsql_corpus');
        $incomplete = false;
        try {
            [$totalAvailable, $references] = $connection->transaction(function () use ($connection, $query, $limit) {
                $connection->statement('SET LOCAL statement_timeout = 5000');
                $capped = (clone $query)->select('hadith_references.id')->limit(self::COUNT_CAP + 1)->toBase();
                $total = min($connection->query()->fromSub($capped, 'capped')->count(), self::COUNT_CAP + 1);

                return [$total, $query->limit($limit)->get()];
            });
        } catch (\Illuminate\Database\QueryException $e) {
            if ($e->getCode() !== '57014') {
                throw $e;
            }
            [$totalAvailable, $references, $incomplete] = [0, collect(), true];
        }

        $results = [];
        $bookDistribution = [];

        foreach ($references as $ref) {
            $bTitle = $ref->book ? ($ref->book->title ?? "Book #{$ref->book_id}") : "Book #{$ref->book_id}";
            $bookDistribution[$bTitle] = ($bookDistribution[$bTitle] ?? 0) + 1;

            $matnText = $ref->hadith ? ($ref->hadith->matn ?? '') : '';
            $snippet = $this->extractSnippet($matnText, $normalizedTerm);

            $results[] = [
                'reference_id' => $ref->id,
                'book_id' => $ref->book_id,
                'book_title' => $bTitle,
                'chapter_title' => $ref->chapter?->title,
                'number' => $ref->number ?? $ref->id,
                'snippet' => $snippet,
            ];
        }

        return [
            'search_term' => $queryTerm,
            'total_matches' => count($results),
            'total_available' => min($totalAvailable, self::COUNT_CAP),
            'total_available_is_capped' => $totalAvailable > self::COUNT_CAP,
            'incomplete' => $incomplete,
            'book_distribution' => (object) $bookDistribution,
            'concordance_samples' => $results,
        ];
    }

    private function normalizeArabic(string $text): string
    {
        $text = preg_replace('/[\x{064B}-\x{065F}\x{0670}]/u', '', $text);
        $text = str_replace(['أ', 'إ', 'آ'], 'ا', $text);
        $text = str_replace('ة', 'ه', $text);
        $text = str_replace('ى', 'ي', $text);
        return trim($text);
    }

    private function extractSnippet(string $text, string $term, int $radius = 40): string
    {
        $pos = mb_stripos($text, $term);
        if ($pos === false) {
            return mb_substr($text, 0, 100) . '...';
        }

        $start = max(0, $pos - $radius);
        $length = mb_strlen($term) + ($radius * 2);
        $snippet = mb_substr($text, $start, $length);

        return ($start > 0 ? '...' : '') . trim($snippet) . '...';
    }
}
