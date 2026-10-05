<?php

namespace App\Services;

class CollationEngineService
{
    /**
     * Normalize classical Arabic text according to specified aggressiveness.
     */
    public function normalize(string $text, bool $stripDiacritics = true, bool $unifyAlif = true, bool $unifyHaa = true): string
    {
        $res = $text;

        if ($stripDiacritics) {
            // Strip Tashkeel & Tatweel
            $res = preg_replace('/[\x{064B}-\x{065F}\x{0670}\x{0640}]/u', '', $res);
        }

        if ($unifyAlif) {
            $res = preg_replace('/[إأآا]/u', 'ا', $res);
            $res = preg_replace('/ى/u', 'ي', $res);
        }

        if ($unifyHaa) {
            $res = preg_replace('/ة/u', 'ه', $res);
        }

        // Punctuation and whitespace
        $res = preg_replace('/[.,:;()\[\]«»\-!؟?]/u', ' ', $res);
        return trim(preg_replace('/\s+/u', ' ', $res));
    }

    /**
     * Tokenize text into an array of words.
     */
    public function tokenize(string $text, bool $normalize = true): array
    {
        $clean = $normalize ? $this->normalize($text) : trim(preg_replace('/\s+/u', ' ', $text));
        if ($clean === '') {
            return [];
        }
        return explode(' ', $clean);
    }

    /**
     * Needleman-Wunsch global sequence alignment adapted for Arabic token arrays.
     */
    public function alignTokens(array $tokensA, array $tokensB, int $matchScore = 2, int $mismatchPenalty = -1, int $gapPenalty = -2): array
    {
        $m = count($tokensA);
        $n = count($tokensB);

        // Scoring matrix & traceback matrix
        $dp = [];
        $trace = []; // 'diag', 'up', 'left'

        for ($i = 0; $i <= $m; $i++) {
            $dp[$i] = [];
            $trace[$i] = [];
            for ($j = 0; $j <= $n; $j++) {
                if ($i === 0 && $j === 0) {
                    $dp[$i][$j] = 0;
                } elseif ($i === 0) {
                    $dp[$i][$j] = $j * $gapPenalty;
                    $trace[$i][$j] = 'left';
                } elseif ($j === 0) {
                    $dp[$i][$j] = $i * $gapPenalty;
                    $trace[$i][$j] = 'up';
                } else {
                    $dp[$i][$j] = 0;
                }
            }
        }

        // Fill dynamic programming table
        for ($i = 1; $i <= $m; $i++) {
            for ($j = 1; $j <= $n; $j++) {
                $isMatch = ($tokensA[$i - 1] === $tokensB[$j - 1]);
                $scoreDiag = $dp[$i - 1][$j - 1] + ($isMatch ? $matchScore : $mismatchPenalty);
                $scoreUp = $dp[$i - 1][$j] + $gapPenalty;
                $scoreLeft = $dp[$i][$j - 1] + $gapPenalty;

                $maxScore = max($scoreDiag, $scoreUp, $scoreLeft);
                $dp[$i][$j] = $maxScore;

                if ($maxScore === $scoreDiag) {
                    $trace[$i][$j] = 'diag';
                } elseif ($maxScore === $scoreUp) {
                    $trace[$i][$j] = 'up';
                } else {
                    $trace[$i][$j] = 'left';
                }
            }
        }

        // Traceback to build aligned representations
        $alignedA = [];
        $alignedB = [];
        $operations = []; // 'match', 'substitution', 'deletion' (saqt), 'insertion' (ziyadah)

        $i = $m;
        $j = $n;

        while ($i > 0 || $j > 0) {
            $direction = $trace[$i][$j] ?? 'diag';

            if ($direction === 'diag') {
                $wordA = $tokensA[$i - 1];
                $wordB = $tokensB[$j - 1];
                $op = ($wordA === $wordB) ? 'match' : 'substitution';
                array_unshift($alignedA, $wordA);
                array_unshift($alignedB, $wordB);
                array_unshift($operations, [
                    'op' => $op,
                    'token_a' => $wordA,
                    'token_b' => $wordB,
                    'pos_a' => $i - 1,
                    'pos_b' => $j - 1,
                ]);
                $i--;
                $j--;
            } elseif ($direction === 'up') {
                // Gap in B -> Deletion / Saqt from A perspective
                $wordA = $tokensA[$i - 1];
                array_unshift($alignedA, $wordA);
                array_unshift($alignedB, '[-]');
                array_unshift($operations, [
                    'op' => 'deletion', // Saqt in B
                    'token_a' => $wordA,
                    'token_b' => null,
                    'pos_a' => $i - 1,
                    'pos_b' => null,
                ]);
                $i--;
            } else {
                // Gap in A -> Insertion / Ziyadah in B
                $wordB = $tokensB[$j - 1];
                array_unshift($alignedA, '[-]');
                array_unshift($alignedB, $wordB);
                array_unshift($operations, [
                    'op' => 'insertion', // Ziyadah in B
                    'token_a' => null,
                    'token_b' => $wordB,
                    'pos_a' => null,
                    'pos_b' => $j - 1,
                ]);
                $j--;
            }
        }

        // Tabulate metrics
        $matches = 0;
        $substitutions = 0;
        $insertions = 0;
        $deletions = 0;

        $apparatusCriticus = [];

        foreach ($operations as $index => $step) {
            switch ($step['op']) {
                case 'match':
                    $matches++;
                    break;
                case 'substitution':
                    $substitutions++;
                    $apparatusCriticus[] = [
                        'type' => 'badal', // Substitution
                        'position' => $index,
                        'baseline' => $step['token_a'],
                        'variant' => $step['token_b'],
                        'description' => "Substituted '{$step['token_a']}' with '{$step['token_b']}'",
                    ];
                    break;
                case 'insertion':
                    $insertions++;
                    $apparatusCriticus[] = [
                        'type' => 'ziyadah', // Addition
                        'position' => $index,
                        'baseline' => null,
                        'variant' => $step['token_b'],
                        'description' => "Addition of '{$step['token_b']}' in variant",
                    ];
                    break;
                case 'deletion':
                    $deletions++;
                    $apparatusCriticus[] = [
                        'type' => 'saqt', // Omission
                        'position' => $index,
                        'baseline' => $step['token_a'],
                        'variant' => null,
                        'description' => "Omission of '{$step['token_a']}' in variant",
                    ];
                    break;
            }
        }

        $totalOps = count($operations);
        $similarity = $totalOps > 0 ? round(($matches / $totalOps) * 100, 2) : 0;

        return [
            'alignment_score' => $dp[$m][$n],
            'similarity_percentage' => $similarity,
            'summary' => [
                'total_aligned_slots' => $totalOps,
                'matches' => $matches,
                'substitutions' => $substitutions,
                'additions_ziyadah' => $insertions,
                'omissions_saqt' => $deletions,
            ],
            'aligned_text_a' => implode(' ', $alignedA),
            'aligned_text_b' => implode(' ', $alignedB),
            'apparatus_criticus' => $apparatusCriticus,
            'operations' => $operations,
        ];
    }

    /**
     * Pairwise or multi-witness collation comparing a baseline against multiple variants.
     */
    public function collateVariants(string $baselineText, array $variants): array
    {
        $baseTokens = $this->tokenize($baselineText);
        $results = [];

        foreach ($variants as $key => $variantText) {
            $label = is_array($variantText) ? ($variantText['label'] ?? "Variant {$key}") : "Variant {$key}";
            $raw = is_array($variantText) ? ($variantText['text'] ?? '') : (string)$variantText;

            $varTokens = $this->tokenize($raw);
            $alignment = $this->alignTokens($baseTokens, $varTokens);

            $results[] = [
                'variant_id' => is_array($variantText) ? ($variantText['id'] ?? $key) : $key,
                'label' => $label,
                'raw_text' => $raw,
                'collation' => $alignment,
            ];
        }

        return [
            'baseline_text' => $baselineText,
            'baseline_token_count' => count($baseTokens),
            'variant_count' => count($variants),
            'comparisons' => $results,
        ];
    }
}
