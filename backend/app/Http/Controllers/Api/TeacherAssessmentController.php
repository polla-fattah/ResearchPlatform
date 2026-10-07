<?php

namespace App\Http\Controllers\Api;

use App\Models\ResearchProject;
use App\Models\NarratorTeacherAssessment;
use App\Services\AuthPolicyService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class TeacherAssessmentController extends ApiController
{
    public function __construct(
        protected AuthPolicyService $policyService
    ) {}

    /**
     * List teacher-specific assessments in the project.
     */
    public function index(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'view', $project);

        $query = NarratorTeacherAssessment::where('project_id', $projectId)->with('creator');

        if ($request->filled('narrator_id')) {
            $query->where('narrator_id', $request->input('narrator_id'));
        }
        if ($request->filled('teacher_id')) {
            $query->where('teacher_id', $request->input('teacher_id'));
        }

        $items = $query->latest('created_at')->get();

        return $this->successResponse($items);
    }

    /**
     * Record a teacher-specific assessment.
     */
    public function store(Request $request, int $projectId): JsonResponse
    {
        $project = ResearchProject::where('is_deleted', false)->findOrFail($projectId);
        $this->policyService->authorizeProject($request->user(), 'edit', $project);

        $validated = $request->validate([
            'narrator_id' => ['required', 'integer', 'exists:pgsql_corpus.narrators,id'],
            'teacher_id' => ['required', 'integer', 'exists:pgsql_corpus.narrators,id'],
            'assessment_category' => 'required|string|in:sound,weakened_specifically,mudallis_from_him,unsubstantiated',
            'critic_name' => 'nullable|string|max:255',
            'qawl_text' => 'required|string',
        ]);

        $assessment = NarratorTeacherAssessment::create([
            'project_id' => $projectId,
            'narrator_id' => $validated['narrator_id'],
            'teacher_id' => $validated['teacher_id'],
            'assessment_category' => $validated['assessment_category'],
            'critic_name' => $validated['critic_name'] ?? null,
            'qawl_text' => $validated['qawl_text'],
            'created_by' => $request->user()->id,
            'created_at' => now(),
        ]);

        return $this->successResponse($assessment->load('creator'), 'Teacher-specific narrator assessment recorded.', 201);
    }
}
