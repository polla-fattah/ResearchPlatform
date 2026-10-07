<?php

namespace App\Services;

use App\Models\LibraryItem;
use App\Models\Resource;
use App\Models\User;

class ReferenceImportService
{
    /**
     * Parse raw BibTeX into entries. A value keeps its inner braces balanced (`{A {B} C}` is read whole and comes
     * out as `A B C`), an `@` inside a value does not end the entry, and a field that is missing stays null.
     *
     * @return array<int, array<string, mixed>>
     */
    public function parseBibTeX(string $bibtexContent): array
    {
        $entries = [];
        $length = strlen($bibtexContent);
        $pos = 0;

        while (($at = strpos($bibtexContent, '@', $pos)) !== false) {
            if (!preg_match('/\G@\s*([a-zA-Z]+)\s*([\{\(])/', $bibtexContent, $head, 0, $at)) {
                $pos = $at + 1;
                continue;
            }

            $type = strtolower($head[1]);
            $open = $head[2];
            $close = $open === '{' ? '}' : ')';
            $bodyStart = $at + strlen($head[0]);
            $bodyEnd = $this->findClosing($bibtexContent, $bodyStart, $open, $close);
            $body = substr($bibtexContent, $bodyStart, $bodyEnd - $bodyStart);
            $pos = min($bodyEnd + 1, $length);

            if (in_array($type, ['comment', 'string', 'preamble'], true)) {
                continue;
            }

            $comma = strpos($body, ',');
            $citeKey = trim($comma === false ? $body : substr($body, 0, $comma));
            $fields = $comma === false ? [] : $this->parseBibTeXFields(substr($body, $comma + 1));

            $entries[] = [
                'cite_key' => $citeKey,
                'type' => $type,
                'title' => $fields['title'] ?? null,
                'author' => $fields['author'] ?? null,
                'year' => $fields['year'] ?? null,
                'publisher' => $fields['publisher'] ?? ($fields['journal'] ?? null),
                'doi' => $fields['doi'] ?? null,
                'url' => $fields['url'] ?? null,
                'raw_fields' => $fields,
            ];
        }

        return $entries;
    }

    /**
     * Parse RIS records (TY ... ER) into the same entry shape as BibTeX.
     *
     * @return array<int, array<string, mixed>>
     */
    public function parseRis(string $risContent): array
    {
        $entries = [];
        $current = null;

        foreach (preg_split('/\R/u', $risContent) ?: [] as $line) {
            if (!preg_match('/^([A-Z][A-Z0-9])\s{1,2}-\s?(.*)$/u', $line, $m)) {
                continue;
            }
            [$tag, $value] = [$m[1], trim($m[2])];

            if ($tag === 'TY') {
                $current = ['TY' => $value, 'AU' => []];
                continue;
            }
            if ($current === null) {
                continue;
            }
            if ($tag === 'ER') {
                $entries[] = $this->risToEntry($current);
                $current = null;
                continue;
            }
            if (in_array($tag, ['AU', 'A1'], true)) {
                $current['AU'][] = $value;
            } elseif (!isset($current[$tag]) && $value !== '') {
                $current[$tag] = $value;
            }
        }

        return $entries;
    }

    /**
     * Save parsed references into the person's own library, one library item each. A reference already in the library,
     * or one with no title, is reported and left out.
     *
     * @return array<string, mixed>
     */
    public function importReferences(array $entries, User $user, array $tags = []): array
    {
        $imported = [];
        $duplicates = [];
        $failed = [];
        $tags = array_values(array_unique(array_merge($tags, ['import ' . now()->format('Y-m-d')])));

        foreach ($entries as $item) {
            $title = isset($item['title']) ? trim((string) $item['title']) : '';
            if ($title === '') {
                $failed[] = ['cite_key' => $item['cite_key'] ?? null, 'reason' => 'The entry has no title.'];
                continue;
            }

            $resource = Resource::firstOrCreate(
                ['resource_type' => 'external', 'title' => $title],
                [
                    'author' => $item['author'] ?? null,
                    'source_metadata' => [
                        'cite_key' => $item['cite_key'] ?? null,
                        'entry_type' => $item['type'] ?? null,
                        'year' => $item['year'] ?? null,
                        'publisher' => $item['publisher'] ?? null,
                        'doi' => $item['doi'] ?? null,
                        'url' => $item['url'] ?? null,
                        'raw_fields' => $item['raw_fields'] ?? [],
                    ],
                    'rights_status' => 'open',
                    'provenance' => 'Imported via BibTeX/RIS ingestion gateway',
                ]
            );

            $existing = LibraryItem::where('user_id', $user->id)->where('resource_id', $resource->id)->first();
            if ($existing) {
                $duplicates[] = ['title' => $title, 'existing_id' => $existing->id];
                continue;
            }

            $imported[] = LibraryItem::create([
                'user_id' => $user->id,
                'resource_id' => $resource->id,
                'is_favourite' => false,
                'snapshot_corpus_version' => 'v2026.09',
                'source_status' => 'current',
                'incomplete_citation_flags' => [],
                'tags' => $tags,
                'notes' => [],
            ])->load('resource');
        }

        return [
            'total_parsed' => count($entries),
            'imported_count' => count($imported),
            'duplicate_count' => count($duplicates),
            'failed_count' => count($failed),
            'imported' => $imported,
            'duplicates' => $duplicates,
            'failed' => $failed,
        ];
    }

    private function findClosing(string $text, int $from, string $open, string $close): int
    {
        $depth = 1;
        $length = strlen($text);
        for ($i = $from; $i < $length; $i++) {
            $char = $text[$i];
            if ($char === $open) {
                $depth++;
            } elseif ($char === $close) {
                $depth--;
                if ($depth === 0) {
                    return $i;
                }
            }
        }

        return $length;
    }

    /**
     * @return array<string, string>
     */
    private function parseBibTeXFields(string $body): array
    {
        $fields = [];
        $length = strlen($body);
        $i = 0;

        while ($i < $length) {
            if (!preg_match('/\G[\s,]*([a-zA-Z][a-zA-Z0-9_\-]*)\s*=\s*/', $body, $m, 0, $i)) {
                break;
            }
            $key = strtolower($m[1]);
            $i += strlen($m[0]);
            $char = $body[$i] ?? '';

            if ($char === '{') {
                $end = $this->findClosing($body, $i + 1, '{', '}');
                $value = substr($body, $i + 1, $end - $i - 1);
                $i = $end + 1;
            } elseif ($char === '"') {
                $j = $i + 1;
                $depth = 0;
                while ($j < $length && !($body[$j] === '"' && $depth === 0)) {
                    $depth += $body[$j] === '{' ? 1 : ($body[$j] === '}' ? -1 : 0);
                    $j++;
                }
                $value = substr($body, $i + 1, $j - $i - 1);
                $i = $j + 1;
            } else {
                $end = strcspn($body, ",\n", $i);
                $value = substr($body, $i, $end);
                $i += $end;
            }

            $value = trim((string) preg_replace('/\s+/u', ' ', str_replace(['{', '}'], '', $value)));
            if ($value !== '') {
                $fields[$key] = $value;
            }
        }

        return $fields;
    }

    /**
     * @param array<string, mixed> $record
     * @return array<string, mixed>
     */
    private function risToEntry(array $record): array
    {
        $year = null;
        foreach (['PY', 'Y1', 'DA'] as $tag) {
            if (!empty($record[$tag]) && preg_match('/\d{4}/', $record[$tag], $y)) {
                $year = $y[0];
                break;
            }
        }

        $title = $record['TI'] ?? $record['T1'] ?? null;
        $publisher = $record['PB'] ?? $record['JO'] ?? $record['JF'] ?? $record['T2'] ?? null;

        return [
            'cite_key' => $record['ID'] ?? null,
            'type' => strtolower((string) ($record['TY'] ?? 'gen')),
            'title' => $title,
            'author' => $record['AU'] ? implode('; ', $record['AU']) : null,
            'year' => $year,
            'publisher' => $publisher,
            'doi' => $record['DO'] ?? null,
            'url' => $record['UR'] ?? null,
            'raw_fields' => array_filter($record, fn ($v) => !is_array($v)),
        ];
    }
}
