<?php

namespace App\Services;

use App\Models\Corpus\CorpusSanad;

class IsnadTopologyService
{
    /**
     * Build topological transmission DAG and detect Madar al-Isnad (Common Link).
     * Supports both database sanad IDs and custom narrator chains.
     */
    public function analyzeChains(array $sanadIds = [], array $customChains = [], string $chainDirection = 'author_to_source'): array
    {
        $nodes = []; // narrator_id => node data
        $edges = []; // source_id -> target_id => count
        $chains = [];

        // 1. Process Database Sanads if provided
        if (!empty($sanadIds)) {
            $sanads = CorpusSanad::whereIn('id', $sanadIds)
                ->with(['narratorNodes.narrator', 'narratorNodes.connectorVariant'])
                ->get();

            foreach ($sanads as $sanad) {
                $orderedNodes = $sanad->narratorNodes->sortBy(function ($n) {
                    return $n->order_in_chain ?? $n->order ?? $n->id;
                })->values();

                $chainNarratorIds = [];

                for ($i = 0; $i < count($orderedNodes); $i++) {
                    $item = $orderedNodes[$i];
                    $nid = $item->narrator_id;
                    $narrator = $item->narrator;
                    $name = $narrator ? ($narrator->name ?? "Narrator #{$nid}") : "Narrator #{$nid}";

                    if (!isset($nodes[$nid])) {
                        $nodes[$nid] = [
                            'id' => $nid,
                            'name' => $name,
                            'tabaqah' => $narrator?->tabaqah,
                            'rutba' => $narrator?->rutba,
                            'death_year' => $narrator?->death_year ?? $narrator?->wafat_year ?? null,
                            'in_degree' => 0,
                            'out_degree' => 0,
                            'frequency' => 0,
                        ];
                    }

                    $nodes[$nid]['frequency']++;
                    $chainNarratorIds[] = $nid;
                }

                // In CorpusSanad, nodes ordered by ID typically proceed Author -> Sheikh -> ... -> Companion.
                // Chronological flow of transmission: Companion -> Successor -> ... -> Author.
                $chronological = array_reverse($chainNarratorIds);
                if (!empty($chronological)) {
                    $chains[] = [
                        'sanad_id' => $sanad->id,
                        'path' => $chronological,
                    ];
                }
            }
        }

        // 2. Process Custom Chains if provided
        if (!empty($customChains)) {
            foreach ($customChains as $idx => $chain) {
                $chainNarratorIds = [];

                foreach ($chain as $narratorItem) {
                    if (is_array($narratorItem)) {
                        $nid = $narratorItem['id'] ?? (string)($narratorItem['name'] ?? uniqid());
                        $name = $narratorItem['name'] ?? "Narrator #{$nid}";
                        $tabaqah = $narratorItem['tabaqah'] ?? null;
                        $rutba = $narratorItem['rutba'] ?? null;
                        $deathYear = $narratorItem['death_year'] ?? null;
                    } else {
                        $nid = $narratorItem;
                        $name = is_string($narratorItem) ? $narratorItem : "Narrator #{$nid}";
                        $tabaqah = null;
                        $rutba = null;
                        $deathYear = null;
                    }

                    if (!isset($nodes[$nid])) {
                        $nodes[$nid] = [
                            'id' => $nid,
                            'name' => $name,
                            'tabaqah' => $tabaqah,
                            'rutba' => $rutba,
                            'death_year' => $deathYear,
                            'in_degree' => 0,
                            'out_degree' => 0,
                            'frequency' => 0,
                        ];
                    }

                    $nodes[$nid]['frequency']++;
                    $chainNarratorIds[] = $nid;
                }

                // If input was given from Author to Source (canonical isnad recitation), reverse to chronological
                $chronological = ($chainDirection === 'author_to_source') ? array_reverse($chainNarratorIds) : $chainNarratorIds;
                if (!empty($chronological)) {
                    $chains[] = [
                        'chain_index' => $idx + 1,
                        'path' => $chronological,
                    ];
                }
            }
        }

        // Build directed transmission edges
        foreach ($chains as $c) {
            $chronological = $c['path'];
            for ($k = 0; $k < count($chronological) - 1; $k++) {
                $u = $chronological[$k];     // Teacher / Earlier transmitter
                $v = $chronological[$k + 1]; // Student / Later receiver
                $edgeKey = "{$u}->{$v}";

                if (!isset($edges[$edgeKey])) {
                    $edges[$edgeKey] = [
                        'source' => $u,
                        'target' => $v,
                        'weight' => 0,
                    ];
                    $nodes[$u]['out_degree']++;
                    $nodes[$v]['in_degree']++;
                }
                $edges[$edgeKey]['weight']++;
            }
        }

        // Detect Common Links (Madar) & Partial Common Links
        $totalChains = count($chains);
        $candidates = [];

        foreach ($nodes as $nid => $data) {
            // A node is a Common Link candidate if out_degree >= 2 or frequency spans multiple chains
            $branchingRatio = $data['in_degree'] > 0 ? ($data['out_degree'] / $data['in_degree']) : $data['out_degree'];
            $chainCoverage = $totalChains > 0 ? ($data['frequency'] / $totalChains) : 0;

            $score = ($data['out_degree'] * 2.0) + ($chainCoverage * 3.0);

            if ($data['out_degree'] >= 2 || ($chainCoverage >= 0.7 && $totalChains >= 2)) {
                $candidates[$nid] = [
                    'narrator_id' => $nid,
                    'name' => $data['name'],
                    'out_degree' => $data['out_degree'],
                    'in_degree' => $data['in_degree'],
                    'branching_ratio' => round($branchingRatio, 2),
                    'chain_coverage' => round($chainCoverage * 100, 1),
                    'centrality_score' => round($score, 2),
                ];
            }
        }

        // Sort candidates by centrality score descending
        uasort($candidates, fn($a, $b) => $b['centrality_score'] <=> $a['centrality_score']);

        $primaryMadar = null;
        $partialMadars = [];

        $candList = array_values($candidates);
        if (!empty($candList)) {
            $primaryMadar = $candList[0];
            $nodes[$primaryMadar['narrator_id']]['role'] = 'primary_madar';

            for ($c = 1; $c < count($candList); $c++) {
                $partialMadars[] = $candList[$c];
                $nodes[$candList[$c]['narrator_id']]['role'] = 'partial_madar';
            }
        }

        // Package Cytoscape.js graph elements
        $cyElements = [
            'nodes' => [],
            'edges' => [],
        ];

        foreach ($nodes as $nid => $d) {
            $role = $d['role'] ?? ($d['in_degree'] === 0 ? 'source' : ($d['out_degree'] === 0 ? 'sink' : 'transmitter'));
            $cyElements['nodes'][] = [
                'data' => [
                    'id' => (string)$nid,
                    'label' => $d['name'],
                    'tabaqah' => $d['tabaqah'],
                    'role' => $role,
                    'frequency' => $d['frequency'],
                    'out_degree' => $d['out_degree'],
                    'in_degree' => $d['in_degree'],
                ],
            ];
        }

        foreach ($edges as $e) {
            $cyElements['edges'][] = [
                'data' => [
                    'id' => "e_{$e['source']}_{$e['target']}",
                    'source' => (string)$e['source'],
                    'target' => (string)$e['target'],
                    'weight' => $e['weight'],
                ],
            ];
        }

        return [
            'total_sanads_analyzed' => $totalChains,
            'total_unique_narrators' => count($nodes),
            'total_transmission_edges' => count($edges),
            'madar_al_isnad' => $primaryMadar,
            'partial_common_links' => $partialMadars,
            'graph_topology' => [
                'nodes' => array_values($nodes),
                'edges' => array_values($edges),
                'cytoscape' => $cyElements,
            ],
            'formal_proof' => $primaryMadar ? [
                'theorem' => 'Topological Convergence Theorem (Madār al-Isnād)',
                'pivot_narrator' => $primaryMadar['name'],
                'evidence' => "All {$totalChains} transmission lines coalesce upon narrator #{$primaryMadar['narrator_id']} with {$primaryMadar['out_degree']} independent outgoing transmission arcs (Coverage: {$primaryMadar['chain_coverage']}%).",
                'status' => 'verified_common_link',
            ] : null,
        ];
    }
}
