<?php

namespace App\Http\Controllers\Api;

use App\Models\ResearchProject;
use App\Models\HadithFamily;
use App\Models\HadithFamilyMember;
use App\Services\AuthPolicyService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class HadithFamilyController extends ApiController
{
    public function __construct(
        protected AuthPolicyService $policyService
    ) {}

    /**
     * List all Hadith families defined in the project.
     */
    public function index(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $families = HadithFamily::where('project_id', $projectId)
            ->with([
                'members.evidence',
                'creator' => fn ($q) => $q->select('id', 'display_name'),
            ])
            ->latest('created_at')
            ->get();

        return $this->successResponse($families);
    }

    /**
     * Create a new Hadith family cluster.
     */
    public function store(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $validated = $request->validate([
            'canonical_title' => 'required|string|max:255',
            'root_companion' => 'nullable|string|max:255',
            'core_theme' => 'nullable|string',
        ]);

        $family = HadithFamily::create([
            'project_id' => $projectId,
            'canonical_title' => $validated['canonical_title'],
            'root_companion' => $validated['root_companion'] ?? null,
            'core_theme' => $validated['core_theme'] ?? null,
            'created_by' => $request->user()->id,
        ]);

        return $this->successResponse(
            $family->load(['creator' => fn ($q) => $q->select('id', 'display_name')]),
            'Hadith family cluster created.',
            201
        );
    }

    /**
     * Update an existing Hadith family.
     */
    public function update(Request $request, int $projectId, int $familyId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $family = HadithFamily::where('project_id', $projectId)->findOrFail($familyId);

        $validated = $request->validate([
            'canonical_title' => 'sometimes|required|string|max:255',
            'root_companion' => 'nullable|string|max:255',
            'core_theme' => 'nullable|string',
        ]);

        $family->update($validated);

        return $this->successResponse(
            $family->load(['creator' => fn ($q) => $q->select('id', 'display_name')]),
            'Hadith family updated.'
        );
    }

    /**
     * Delete an existing Hadith family.
     */
    public function destroy(Request $request, int $projectId, int $familyId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $family = HadithFamily::where('project_id', $projectId)->findOrFail($familyId);
        $family->members()->delete();
        $family->delete();

        return $this->successResponse([], 'Hadith family deleted.');
    }

    /**
     * Add a member (Mutaba'ah or Shahid) to the Hadith family.
     */
    public function addMember(Request $request, int $projectId, int $familyId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $family = HadithFamily::where('project_id', $projectId)->findOrFail($familyId);

        $validated = $request->validate([
            'evidence_id' => 'nullable|integer|exists:evidence_items,id',
            'corpus_hadith_id' => 'nullable|integer|exists:pgsql_corpus.hadiths,id',
            'corpus_sanad_id' => 'nullable|integer',
            'relationship_type' => 'required|string|max:64',
            'convergence_narrator' => 'nullable|string|max:255',
            'convergence_depth' => 'nullable|integer',
            'scholarly_notes' => 'nullable|string',
        ]);

        if (empty($validated['evidence_id']) && empty($validated['corpus_hadith_id']) && empty($validated['corpus_sanad_id'])) {
            return $this->errorResponse('At least one source (evidence_id, corpus_hadith_id, or corpus_sanad_id) must be specified.', 'NO_SOURCE_SPECIFIED', 422);
        }

        // Prevent duplicate member in the same family
        $existsQuery = HadithFamilyMember::where('family_id', $family->id);
        if (!empty($validated['evidence_id'])) {
            $existsQuery->where('evidence_id', $validated['evidence_id']);
        } elseif (!empty($validated['corpus_hadith_id'])) {
            $existsQuery->where('corpus_hadith_id', $validated['corpus_hadith_id']);
        } elseif (!empty($validated['corpus_sanad_id'])) {
            $existsQuery->where('corpus_sanad_id', $validated['corpus_sanad_id']);
        }

        if ($existsQuery->exists()) {
            return $this->errorResponse('A member with this source already exists in this family.', 'DUPLICATE_FAMILY_MEMBER', 422);
        }

        $member = HadithFamilyMember::create([
            'family_id' => $family->id,
            'evidence_id' => $validated['evidence_id'] ?? null,
            'corpus_hadith_id' => $validated['corpus_hadith_id'] ?? null,
            'corpus_sanad_id' => $validated['corpus_sanad_id'] ?? null,
            'relationship_type' => $validated['relationship_type'],
            'convergence_narrator' => $validated['convergence_narrator'] ?? null,
            'convergence_depth' => $validated['convergence_depth'] ?? null,
            'scholarly_notes' => $validated['scholarly_notes'] ?? null,
            'created_at' => now(),
        ]);

        return $this->successResponse($member->load('evidence'), 'Hadith family member attached.', 201);
    }

    /**
     * Remove a member from the Hadith family.
     */
    public function removeMember(Request $request, int $projectId, int $familyId, int $memberId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $family = HadithFamily::where('project_id', $projectId)->findOrFail($familyId);
        $member = HadithFamilyMember::where('family_id', $family->id)->findOrFail($memberId);
        $member->delete();

        return $this->successResponse([], 'Member detached from Hadith family.');
    }
}
