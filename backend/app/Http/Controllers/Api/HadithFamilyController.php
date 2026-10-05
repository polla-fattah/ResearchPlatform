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
            ->with(['members.evidence', 'creator'])
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

        return $this->successResponse($family->load('creator'), 'Hadith family cluster created.', 201);
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
            'corpus_hadith_id' => 'nullable|integer',
            'corpus_sanad_id' => 'nullable|integer',
            'relationship_type' => 'required|string|in:mutabaah_tammah,mutabaah_qasirah,shahid,candidate',
            'convergence_narrator' => 'nullable|string|max:255',
            'convergence_depth' => 'nullable|integer',
            'scholarly_notes' => 'nullable|string',
        ]);

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
