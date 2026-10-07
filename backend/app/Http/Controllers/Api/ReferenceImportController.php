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

        return $this->previewResponse($this->importService->parseBibTeX($validated['bibtex']), 'BibTeX parsed successfully.');
    }

    public function importBibTeX(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'bibtex' => 'required|string',
            'tags' => 'nullable|array',
            'tags.*' => 'string|max:50',
        ]);

        $parsed = $this->importService->parseBibTeX($validated['bibtex']);

        return $this->successResponse(
            $this->importService->importReferences($parsed, $request->user(), $validated['tags'] ?? []),
            'Bibliographical references imported into your library.',
            201
        );
    }

    public function previewRis(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ris' => 'required|string',
        ]);

        return $this->previewResponse($this->importService->parseRis($validated['ris']), 'RIS parsed successfully.');
    }

    public function importRis(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ris' => 'required|string',
            'tags' => 'nullable|array',
            'tags.*' => 'string|max:50',
        ]);

        $parsed = $this->importService->parseRis($validated['ris']);

        return $this->successResponse(
            $this->importService->importReferences($parsed, $request->user(), $validated['tags'] ?? []),
            'Bibliographical references imported into your library.',
            201
        );
    }

    /**
     * @param array<int, array<string, mixed>> $entries
     */
    private function previewResponse(array $entries, string $message): JsonResponse
    {
        return $this->successResponse([
            'total_parsed' => count($entries),
            'entries' => $entries,
        ], $message);
    }
}
