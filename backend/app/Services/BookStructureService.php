<?php

namespace App\Services;

use App\Models\Corpus\CorpusBook;
use App\Models\Corpus\CorpusChapter;
use App\Models\Corpus\CorpusHadithReference;
use App\Models\Corpus\CorpusHadith;
use Illuminate\Support\Facades\DB;

class BookStructureService
{
    /**
     * Retrieve the hierarchical table of contents and scoped occurrence counts.
     */
    public function getCollectionStructure(int $bookId): array
    {
        $book = CorpusBook::find($bookId);
        $bookTitle = $book ? ($book->title ?? "Book #{$bookId}") : "Book #{$bookId}";
        $author = $book ? ($book->author ?? null) : null;

        // Fetch chapters belonging to this book
        $chapters = CorpusChapter::where('book_id', $bookId)
            ->orderBy('id')
            ->get();

        $structure = [];
        $totalOccurrences = 0;

        foreach ($chapters as $chapter) {
            $occurrenceCount = CorpusHadithReference::where('chapter_id', $chapter->id)->count();
            $totalOccurrences += $occurrenceCount;

            $structure[] = [
                'chapter_id' => $chapter->id,
                'chapter_title' => $chapter->title ?? "Chapter #{$chapter->id}",
                'chapter_number' => $chapter->number ?? $chapter->id,
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

        $query = CorpusHadithReference::query()
            ->with(['book', 'chapter', 'hadith']);

        if ($bookId) {
            $query->where('book_id', $bookId);
        }

        // Search text occurrences via related hadith
        $query->whereHas('hadith', function ($q) use ($normalizedTerm) {
            $q->where('clean_matn', 'ILIKE', "%{$normalizedTerm}%")
              ->orWhere('matn', 'ILIKE', "%{$normalizedTerm}%");
        })->limit($limit);

        $references = $query->get();

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
            'book_distribution' => $bookDistribution,
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
