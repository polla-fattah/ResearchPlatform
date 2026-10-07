<?php

namespace App\Http\Controllers\Api;

use App\Models\LibraryUpload;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LibraryUploadController extends ApiController
{
    /**
     * The person's uploads with their scan status. A file is not usable until its status is `clean`; no scanner is
     * connected yet, so every upload stays `pending`.
     */
    public function index(Request $request): JsonResponse
    {
        $uploads = LibraryUpload::where('user_id', $request->user()->id)
            ->latest()
            ->paginate(min((int) $request->input('per_page', 20), 100));

        return $this->paginatedResponse($uploads);
    }

    /**
     * Accept a scan or file (PDF, JPEG, PNG, TIFF, CSV or DOCX, up to 200 MB) with its rights statement.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'file' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png,tif,tiff,csv,docx', 'max:204800'],
            'kind' => 'required|string|in:scan,manuscript,dataset,document,other',
            'description' => 'nullable|string|max:2000',
            'rights_statement' => 'required|string|max:2000',
            'ownership_confirmed' => 'required|accepted',
        ]);

        $file = $validated['file'];
        $path = $file->store('library-uploads/' . $request->user()->id);

        $upload = LibraryUpload::create([
            'user_id' => $request->user()->id,
            'filename' => $file->getClientOriginalName(),
            'storage_path' => $path,
            'mime_type' => (string) $file->getMimeType(),
            'file_size' => $file->getSize(),
            'checksum' => hash_file('sha256', $file->getRealPath()),
            'kind' => $validated['kind'],
            'description' => $validated['description'] ?? null,
            'rights_statement' => $validated['rights_statement'],
            'ownership_confirmed' => true,
            'scan_status' => 'pending',
        ]);

        return $this->successResponse($upload, 'Upload received; it cannot be used until it has been scanned.', 201);
    }
}
