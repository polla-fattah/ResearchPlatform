<?php

namespace App\Http\Controllers\Api;

use App\Models\GeographicalPlace;
use App\Models\NarratorTrajectory;
use App\Services\GeospatialService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GeospatialController extends ApiController
{
    public function __construct(
        protected GeospatialService $geospatialService
    ) {}

    public function getPlaces(): JsonResponse
    {
        $geojson = $this->geospatialService->getPlacesFeatureCollection();
        return $this->successResponse($geojson, 'Historical transmission places retrieved.');
    }

    public function getNarratorTrajectory(int $narratorId): JsonResponse
    {
        $trajectory = $this->geospatialService->getNarratorTrajectory($narratorId);
        return $this->successResponse($trajectory, 'Narrator geographical trajectory retrieved.');
    }

    public function recordTrajectory(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'narrator_id' => 'required|integer',
            'place_id' => 'required|integer|exists:geographical_places,id',
            'trajectory_type' => 'required|string|in:birth,death,residence,rihlah,audition',
            'year_hijri_start' => 'nullable|integer',
            'year_hijri_end' => 'nullable|integer',
            'evidence_text' => 'nullable|string',
            'is_inferred' => 'nullable|boolean',
        ]);

        $trajectory = NarratorTrajectory::create([
            'narrator_id' => $validated['narrator_id'],
            'place_id' => $validated['place_id'],
            'trajectory_type' => $validated['trajectory_type'],
            'year_hijri_start' => $validated['year_hijri_start'] ?? null,
            'year_hijri_end' => $validated['year_hijri_end'] ?? null,
            'evidence_text' => $validated['evidence_text'] ?? null,
            'is_inferred' => $validated['is_inferred'] ?? false,
            'created_at' => now(),
        ]);

        return $this->successResponse($trajectory->load('place'), 'Narrator trajectory point recorded.', 201);
    }

    public function getIsnadGeographicFlow(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'narrator_ids' => 'required|array|min:2',
            'narrator_ids.*' => 'integer',
        ]);

        $flow = $this->geospatialService->getChainGeographicFlow($validated['narrator_ids']);

        return $this->successResponse($flow, 'Isnād geographical transmission flow computed.');
    }
}
