<?php

namespace App\Http\Controllers\Api;

use App\Services\ReferenceImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReferenceImportController extends ApiController
{
    public function __construct(
        protected ReferenceImportService $importService
    ) {}

    public function previewBibTeX(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'bibtex' => 'required|string',
        ]);

        $parsed = $this->importService->parseBibTeX($validated['bibtex']);

        return $this->successResponse([
            'total_parsed' => count($parsed),
            'entries' => $parsed,
        ], 'BibTeX parsed successfully.');
    }

    public function importBibTeX(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'bibtex' => 'required|string',
        ]);

        $parsed = $this->importService->parseBibTeX($validated['bibtex']);
        $result = $this->importService->importReferences($parsed);

        return $this->successResponse($result, 'Bibliographical references imported.', 201);
    }
}
