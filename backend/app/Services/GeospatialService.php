<?php

namespace App\Services;

use App\Models\GeographicalPlace;
use App\Models\NarratorTrajectory;
use App\Models\Corpus\CorpusNarrator;

class GeospatialService
{
    /**
     * Retrieve all historical places with GeoJSON feature collection.
     */
    public function getPlacesFeatureCollection(): array
    {
        $places = GeographicalPlace::all();

        $features = [];
        foreach ($places as $place) {
            $features[] = [
                'type' => 'Feature',
                'geometry' => [
                    'type' => 'Point',
                    'coordinates' => [$place->longitude, $place->latitude],
                ],
                'properties' => [
                    'id' => $place->id,
                    'name_ar' => $place->canonical_name_ar,
                    'name_en' => $place->canonical_name_en,
                    'region' => $place->region,
                    'notes' => $place->historical_notes,
                ],
            ];
        }

        return [
            'type' => 'FeatureCollection',
            'features' => $features,
        ];
    }

    /**
     * Compute chronological trajectory and GeoJSON LineString for a narrator.
     */
    public function getNarratorTrajectory(int $narratorId): array
    {
        $narrator = CorpusNarrator::find($narratorId);
        $name = $narrator ? ($narrator->name ?? "Narrator #{$narratorId}") : "Narrator #{$narratorId}";

        $trajectories = NarratorTrajectory::where('narrator_id', $narratorId)
            ->with('place')
            ->orderBy('year_hijri_start')
            ->get();

        $coords = [];
        $stops = [];

        foreach ($trajectories as $t) {
            if ($t->place && $t->place->latitude && $t->place->longitude) {
                $coords[] = [$t->place->longitude, $t->place->latitude];
                $stops[] = [
                    'place_name_ar' => $t->place->canonical_name_ar,
                    'place_name_en' => $t->place->canonical_name_en,
                    'region' => $t->place->region,
                    'type' => $t->trajectory_type,
                    'year_start' => $t->year_hijri_start,
                    'year_end' => $t->year_hijri_end,
                    'is_inferred' => $t->is_inferred,
                    'evidence' => $t->evidence_text,
                ];
            }
        }

        $geoJson = [
            'type' => 'Feature',
            'geometry' => [
                'type' => count($coords) > 1 ? 'LineString' : (count($coords) === 1 ? 'Point' : 'GeometryCollection'),
                'coordinates' => count($coords) > 1 ? $coords : ($coords[0] ?? []),
            ],
            'properties' => [
                'narrator_id' => $narratorId,
                'name' => $name,
                'total_stops' => count($stops),
            ],
        ];

        return [
            'narrator_id' => $narratorId,
            'name' => $name,
            'total_trajectory_points' => count($stops),
            'stops' => $stops,
            'geojson' => $geoJson,
        ];
    }

    /**
     * Compute geographical transmission arc between centers for a chain of narrators.
     */
    public function getChainGeographicFlow(array $narratorIds): array
    {
        $flow = [];
        $lineCoords = [];

        foreach ($narratorIds as $nid) {
            // Find most prominent location (death or residence)
            $traj = NarratorTrajectory::where('narrator_id', $nid)
                ->with('place')
                ->orderByRaw("CASE WHEN trajectory_type = 'death' THEN 1 WHEN trajectory_type = 'residence' THEN 2 ELSE 3 END")
                ->first();

            if ($traj && $traj->place) {
                $flow[] = [
                    'narrator_id' => $nid,
                    'place_name_en' => $traj->place->canonical_name_en,
                    'place_name_ar' => $traj->place->canonical_name_ar,
                    'region' => $traj->place->region,
                    'coordinates' => [$traj->place->longitude, $traj->place->latitude],
                ];
                $lineCoords[] = [$traj->place->longitude, $traj->place->latitude];
            }
        }

        return [
            'narrator_count' => count($narratorIds),
            'located_nodes' => count($flow),
            'geographic_flow' => $flow,
            'geojson_path' => [
                'type' => 'Feature',
                'geometry' => [
                    'type' => 'LineString',
                    'coordinates' => $lineCoords,
                ],
                'properties' => [
                    'description' => 'Geographical transmission flow across Islamic centers',
                ],
            ],
        ];
    }
}
