<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class DocsController extends Controller
{
    /**
     * Interactive Scalar & Swagger UI Documentation Viewer.
     */
    public function index()
    {
        return view('docs');
    }

    /**
     * Serve OpenAPI 3.1 JSON specification.
     */
    public function openApiJson(): JsonResponse
    {
        $path = public_path('docs/openapi.json');
        if (!file_exists($path)) {
            abort(404, 'OpenAPI specification not generated yet.');
        }

        $json = json_decode(file_get_contents($path), true);
        return response()->json($json);
    }

    /**
     * Download Postman Collection v2.1.
     */
    public function postman(): BinaryFileResponse
    {
        $path = public_path('docs/postman_collection.json');
        if (!file_exists($path)) {
            abort(404, 'Postman collection not generated.');
        }

        return response()->download($path, 'OpenHadith_Platform.postman_collection.json', [
            'Content-Type' => 'application/json',
        ]);
    }
}
