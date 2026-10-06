<?php

namespace App\Services;

use App\Models\Corpus\CorpusHadith;
use App\Models\Corpus\CorpusSanad;
use App\Models\Corpus\CorpusNarrator;
use App\Models\Corpus\CorpusAlemQawlDetail;
use InvalidArgumentException;

class AnalysisWorkbenchService
{
    /**
     * Normalize Arabic text for comparative lexical analysis.
     */
    public function normalizeArabic(string $text): string
    {
        // Remove diacritics / tashkeel
        $normalized = preg_replace('/[\x{064B}-\x{065F}\x{0670}\x{0640}]/u', '', $text);
        // Normalize alefs
        $normalized = preg_replace('/[إأآا]/u', 'ا', $normalized);
        // Normalize taa marbuta
        $normalized = preg_replace('/ة/u', 'ه', $normalized);
        // Normalize alef maqsura
        $normalized = preg_replace('/ى/u', 'ي', $normalized);
        // Normalize punctuation and whitespace
        $normalized = preg_replace('/[.,:;()\[\]«»\-!؟?]/u', ' ', $normalized);
        return trim(preg_replace('/\s+/u', ' ', $normalized));
    }

    /**
     * Tokenize text into words.
     */
    public function tokenize(string $text): array
    {
        $normalized = $this->normalizeArabic($text);
        if ($normalized === '') {
            return [];
        }
        return explode(' ', $normalized);
    }

    /**
     * Module 7: Side-by-side textual occurrence comparison (Matn Compare).
     */
    public function matnCompare(array $hadithIds, ?int $baselineId = null, array $customTexts = []): array
    {
        $variants = [];

        // Load corpus hadiths if IDs are provided
        if (!empty($hadithIds)) {
            $hadiths = CorpusHadith::whereIn('id', $hadithIds)->get()->keyBy('id');
            foreach ($hadithIds as $id) {
                if (isset($hadiths[$id])) {
                    $h = $hadiths[$id];
                    $rawText = $h->clean_matn ?: ($h->matn ?: ($h->full_hadith ?: ''));
                    $tokens = $this->tokenize($rawText);
                    $variants[] = [
                        'id' => $h->id,
                        'raw_text' => $rawText,
                        'normalized_text' => $this->normalizeArabic($rawText),
                        'token_count' => count($tokens),
                        'tokens' => $tokens,
                    ];
                }
            }
        }

        // Add any custom/external texts
        foreach ($customTexts as $index => $item) {
            $text = is_array($item) ? ($item['text'] ?? '') : (string)$item;
            $tokens = $this->tokenize($text);
            $variants[] = [
                'id' => is_array($item) ? ($item['id'] ?? "custom_{$index}") : "custom_{$index}",
                'label' => is_array($item) ? ($item['label'] ?? "Variant " . ($index + 1)) : "Variant " . ($index + 1),
                'raw_text' => $text,
                'normalized_text' => $this->normalizeArabic($text),
                'token_count' => count($tokens),
                'tokens' => $tokens,
            ];
        }

        if (count($variants) < 2) {
            throw new InvalidArgumentException("At least two texts or hadith variants are required for comparison.");
        }

        // Determine baseline
        $baseline = $variants[0];
        if ($baselineId !== null) {
            foreach ($variants as $v) {
                if ($v['id'] == $baselineId) {
                    $baseline = $v;
                    break;
                }
            }
        }

        // Analyze vocabulary across variants
        $variantTokenSets = [];
        $allTokens = [];
        foreach ($variants as $v) {
            $set = array_unique($v['tokens']);
            $variantTokenSets[$v['id']] = $set;
            $allTokens = array_merge($allTokens, $set);
        }
        $allUniqueTokens = array_values(array_unique($allTokens));

        // Shared tokens (present in ALL variants)
        $sharedTokens = $variantTokenSets[$variants[0]['id']];
        foreach ($variants as $v) {
            $sharedTokens = array_intersect($sharedTokens, $variantTokenSets[$v['id']]);
        }
        $sharedTokens = array_values($sharedTokens);

        // Unique tokens per variant (ziyadah / unique phrase)
        $variantSpecifics = [];
        foreach ($variants as $v) {
            $otherTokens = [];
            foreach ($variants as $other) {
                if ($other['id'] !== $v['id']) {
                    $otherTokens = array_merge($otherTokens, $variantTokenSets[$other['id']]);
                }
            }
            $uniqueToThis = array_values(array_diff($variantTokenSets[$v['id']], array_unique($otherTokens)));
            $variantSpecifics[$v['id']] = [
                'unique_tokens' => $uniqueToThis,
                'unique_count' => count($uniqueToThis),
            ];
        }

        // Pairwise Jaccard similarity matrix
        $similarityMatrix = [];
        foreach ($variants as $v1) {
            $row = [];
            $set1 = $variantTokenSets[$v1['id']];
            foreach ($variants as $v2) {
                $set2 = $variantTokenSets[$v2['id']];
                $intersection = count(array_intersect($set1, $set2));
                $union = count(array_unique(array_merge($set1, $set2)));
                $similarity = $union > 0 ? round(($intersection / $union) * 100, 2) : 0;
                $row[$v2['id']] = $similarity;
            }
            $similarityMatrix[$v1['id']] = $row;
        }

        // Token diff compared to baseline
        $diffs = [];
        $baseTokens = $baseline['tokens'];
        foreach ($variants as $v) {
            if ($v['id'] === $baseline['id']) {
                continue;
            }
            $diffs[$v['id']] = [
                'target_id' => $v['id'],
                'additions' => array_values(array_diff($v['tokens'], $baseTokens)),
                'deletions' => array_values(array_diff($baseTokens, $v['tokens'])),
                'overlap_count' => count(array_intersect($v['tokens'], $baseTokens)),
            ];
        }

        return [
            'analysis_type' => 'matn_comparison',
            'baseline_id' => $baseline['id'],
            'variant_count' => count($variants),
            'variants' => $variants,
            'consensus_core_tokens' => $sharedTokens,
            'consensus_core_count' => count($sharedTokens),
            'unique_words_summary' => $variantSpecifics,
            'similarity_matrix' => $similarityMatrix,
            'diff_against_baseline' => $diffs,
        ];
    }

    /**
     * Module 7: Transmission chain comparison & Common Link (Madar) detection (Isnad Compare).
     */
    public function isnadCompare(array $sanadIds): array
    {
        if (count($sanadIds) < 2) {
            throw new InvalidArgumentException("At least two sanad IDs are required for isnad comparison.");
        }

        $sanads = CorpusSanad::whereIn('id', $sanadIds)
            ->with(['narratorNodes.narrator', 'narratorNodes.connectorVariant'])
            ->get()
            ->keyBy('id');

        $chains = [];
        $narratorFrequency = [];
        $narratorMetadata = [];

        foreach ($sanadIds as $sanadId) {
            if (!isset($sanads[$sanadId])) {
                continue;
            }

            $sanad = $sanads[$sanadId];
            $nodes = $sanad->narratorNodes;
            $chainList = [];

            foreach ($nodes as $index => $node) {
                $narrator = $node->narrator;
                $narratorId = $node->narrator_id;
                $narratorName = $narrator ? ($narrator->name ?? "Narrator #{$narratorId}") : "Narrator #{$narratorId}";

                $chainList[] = [
                    'order' => $index + 1,
                    'narrator_id' => $narratorId,
                    'name' => $narratorName,
                    'tabaqah' => $narrator?->tabaqah,
                    'rutba' => $narrator?->rutba,
                    'connector' => $node->connectorVariant?->variant ?? null,
                ];

                if (!isset($narratorFrequency[$narratorId])) {
                    $narratorFrequency[$narratorId] = 0;
                    $narratorMetadata[$narratorId] = [
                        'id' => $narratorId,
                        'name' => $narratorName,
                        'tabaqah' => $narrator?->tabaqah,
                        'rutba' => $narrator?->rutba,
                    ];
                }
                $narratorFrequency[$narratorId]++;
            }

            $chains[$sanadId] = [
                'sanad_id' => $sanadId,
                'length' => count($chainList),
                'narrators' => $chainList,
            ];
        }

        $totalChains = count($chains);
        if ($totalChains < 2) {
            throw new InvalidArgumentException("Could not find at least two valid sanads with narrator chains.");
        }

        // Identify Common Link (Madar / مدار الإسناد)
        // The common link is the narrator appearing in all (or maximum number of) chains,
        // typically the earliest common pivot before diverging to students.
        $commonLinks = [];
        $partialCommonLinks = [];

        foreach ($narratorFrequency as $nId => $freq) {
            if ($freq === $totalChains) {
                $commonLinks[] = array_merge($narratorMetadata[$nId], ['frequency' => $freq]);
            } elseif ($freq >= 2 && $freq < $totalChains) {
                $partialCommonLinks[] = array_merge($narratorMetadata[$nId], ['frequency' => $freq]);
            }
        }

        // Determine divergence point (first narrator index where chains differ)
        $minChainLength = min(array_map(fn($c) => $c['length'], $chains));
        $divergenceIndex = null;
        for ($i = 0; $i < $minChainLength; $i++) {
            $currentNarratorIds = [];
            foreach ($chains as $c) {
                $currentNarratorIds[] = $c['narrators'][$i]['narrator_id'];
            }
            if (count(array_unique($currentNarratorIds)) > 1) {
                $divergenceIndex = $i + 1; // 1-based order
                break;
            }
        }

        return [
            'analysis_type' => 'isnad_comparison',
            'chain_count' => $totalChains,
            'chains' => array_values($chains),
            'common_links' => $commonLinks,
            'partial_common_links' => $partialCommonLinks,
            'divergence_order' => $divergenceIndex,
            'summary' => [
                'has_universal_common_link' => count($commonLinks) > 0,
                'common_link_count' => count($commonLinks),
                'pivotal_narrator' => !empty($commonLinks) ? $commonLinks[0]['name'] : null,
            ],
        ];
    }

    /**
     * Module 7: Cross-tabulated Criticism Matrix for selected narrators.
     */
    public function criticismMatrix(array $narratorIds, array $criticScholarIds = []): array
    {
        if (empty($narratorIds)) {
            throw new InvalidArgumentException("At least one narrator ID is required for criticism matrix.");
        }

        $narrators = CorpusNarrator::whereIn('id', $narratorIds)
            ->with(['criticisms.scholar', 'criticisms.book', 'criticisms.hukm'])
            ->get();

        $allCritics = [];
        $matrix = [];
        $narratorSummaries = [];

        foreach ($narrators as $narrator) {
            $narratorData = [
                'id' => $narrator->id,
                'name' => $narrator->name,
                'rutba' => $narrator->rutba,
                'tabaqah' => $narrator->tabaqah,
            ];

            $criticisms = $narrator->criticisms;
            if (!empty($criticScholarIds)) {
                $criticisms = $criticisms->whereIn('alem_id', $criticScholarIds);
            }

            $evaluations = [];
            $taadilCount = 0;
            $jarhCount = 0;

            foreach ($criticisms as $c) {
                $criticId = $c->alem_id;
                $criticName = $c->scholar?->name ?? "Scholar #{$criticId}";
                $hukmName = $c->hukm?->name ?? $c->raw_hukm ?? 'Unspecified';

                $allCritics[$criticId] = [
                    'id' => $criticId,
                    'name' => $criticName,
                ];

                $quote = $c->qawl ?? $c->qawl_text ?? null;

                // Rough categorization for consensus index (C-19)
                if (preg_match('/(ثقة|صدوق|حجة|إمام|صالح|مستقيم)/u', $hukmName) || ($hukmName === 'Unspecified' && $quote && preg_match('/(ثقة|صدوق|حجة|إمام|صالح|مستقيم)/u', $quote))) {
                    $taadilCount++;
                } elseif (preg_match('/(ضعيف|متروك|كذاب|وضاع|منكر|ليس بشيء)/u', $hukmName) || ($hukmName === 'Unspecified' && $quote && preg_match('/(ضعيف|متروك|كذاب|وضاع|منكر|ليس بشيء)/u', $quote))) {
                    $jarhCount++;
                }

                if (!isset($evaluations[$criticId])) {
                    $evaluations[$criticId] = [
                        'scholar_id' => $criticId,
                        'scholar_name' => $criticName,
                        'hukm' => $hukmName,
                        'source_book' => $c->book?->name,
                        'quote' => $quote,
                        'statements' => [],
                    ];
                }

                $evaluations[$criticId]['statements'][] = [
                    'hukm' => $hukmName,
                    'source_book' => $c->book?->name,
                    'quote' => $quote,
                ];
                $evaluations[$criticId]['hukm'] = $hukmName;
                $evaluations[$criticId]['quote'] = $quote;
            }

            $matrix[$narrator->id] = [
                'narrator' => $narratorData,
                'evaluations' => $evaluations,
                'counts' => [
                    'total_statements' => $criticisms->count(),
                    'taadil' => $taadilCount,
                    'jarh' => $jarhCount,
                ],
            ];

            $narratorSummaries[] = [
                'narrator_id' => $narrator->id,
                'name' => $narrator->name,
                'total_evaluations' => $criticisms->count(),
                'taadil_ratio' => ($taadilCount + $jarhCount) > 0 ? round(($taadilCount / ($taadilCount + $jarhCount)) * 100, 1) : null,
            ];
        }

        return [
            'analysis_type' => 'criticism_matrix',
            'narrator_count' => $narrators->count(),
            'scholars' => array_values($allCritics),
            'matrix' => $matrix,
            'summary' => $narratorSummaries,
        ];
    }
}
