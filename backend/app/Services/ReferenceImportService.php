<?php

namespace App\Services;

use App\Models\Resource;

class ReferenceImportService
{
    /**
     * Parse raw BibTeX entries and extract structured bibliographic references.
     */
    public function parseBibTeX(string $bibtexContent): array
    {
        $entries = [];
        $pattern = '/@([a-zA-Z]+)\s*\{([^,]+),\s*([^@]+)\}/s';

        if (preg_match_all($pattern, $bibtexContent, $matches, PREG_SET_ORDER)) {
            foreach ($matches as $match) {
                $type = strtolower($match[1]);
                $citeKey = trim($match[2]);
                $body = $match[3];

                $fields = [];
                $fieldPattern = '/([a-zA-Z]+)\s*=\s*[\{"\'](.*?)[\}"\'],?\s*(?=[a-zA-Z]+\s*=|[\}\s]*$)/s';

                if (preg_match_all($fieldPattern, $body, $fMatches, PREG_SET_ORDER)) {
                    foreach ($fMatches as $f) {
                        $key = strtolower(trim($f[1]));
                        $val = trim($f[2]);
                        $fields[$key] = $val;
                    }
                }

                $entries[] = [
                    'cite_key' => $citeKey,
                    'type' => $type,
                    'title' => $fields['title'] ?? 'Untitled Bibliographical Item',
                    'author' => $fields['author'] ?? 'Unknown Author',
                    'year' => $fields['year'] ?? null,
                    'publisher' => $fields['publisher'] ?? ($fields['journal'] ?? null),
                    'doi' => $fields['doi'] ?? null,
                    'url' => $fields['url'] ?? null,
                    'raw_fields' => $fields,
                ];
            }
        }

        return $entries;
    }

    /**
     * Import parsed bibliography references into resources table.
     */
    public function importReferences(array $entries): array
    {
        $imported = [];
        $duplicates = [];

        foreach ($entries as $item) {
            $existing = Resource::where('resource_type', 'external_reference')
                ->where('title', $item['title'])
                ->first();

            if ($existing) {
                $duplicates[] = [
                    'title' => $item['title'],
                    'existing_id' => $existing->id,
                ];
                continue;
            }

            $res = Resource::create([
                'resource_type' => 'external_reference',
                'title' => $item['title'],
                'author' => $item['author'],
                'source_metadata' => [
                    'cite_key' => $item['cite_key'],
                    'entry_type' => $item['type'],
                    'year' => $item['year'],
                    'publisher' => $item['publisher'],
                    'doi' => $item['doi'],
                    'url' => $item['url'],
                    'raw_fields' => $item['raw_fields'] ?? [],
                ],
                'rights_status' => 'open',
                'provenance' => 'Imported via BibTeX/RIS ingestion gateway',
            ]);

            $imported[] = $res;
        }

        return [
            'total_parsed' => count($entries),
            'imported_count' => count($imported),
            'duplicate_count' => count($duplicates),
            'imported' => $imported,
            'duplicates' => $duplicates,
        ];
    }
}
