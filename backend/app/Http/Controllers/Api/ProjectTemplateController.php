<?php

namespace App\Http\Controllers\Api;

use App\Models\ProjectTemplate;
use App\Models\ResearchProject;
use App\Models\Task;
use App\Models\ProjectMembership;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProjectTemplateController extends ApiController
{
    public function index(): JsonResponse
    {
        $templates = ProjectTemplate::all();
        return $this->successResponse($templates, 'Project templates retrieved.');
    }

    public function show(int $id): JsonResponse
    {
        $template = ProjectTemplate::findOrFail($id);
        return $this->successResponse($template);
    }

    public function instantiate(Request $request, int $id): JsonResponse
    {
        $template = ProjectTemplate::findOrFail($id);

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'custom_question' => 'nullable|string',
            'primary_language' => 'nullable|string|in:ar,ckb,en',
        ]);

        $project = ResearchProject::create([
            'title' => $validated['title'],
            'owner_id' => $request->user()->id,
            'question' => $validated['custom_question'] ?? $template->default_question,
            'scope' => "Instantiated from {$template->title} template.",
            'primary_language' => $validated['primary_language'] ?? 'ar',
            'stage' => $this->startingStage($template),
            'is_deleted' => false,
        ]);

        // Add owner membership
        ProjectMembership::create([
            'project_id' => $project->id,
            'user_id' => $request->user()->id,
            'role' => 'owner',
            'status' => 'accepted',
            'accepted_at' => now(),
        ]);

        // Prepopulate template recommended tasks if available
        if (!empty($template->default_tasks)) {
            foreach ($template->default_tasks as $taskData) {
                Task::create([
                    'project_id' => $project->id,
                    'title' => $taskData['title'],
                    'status' => 'open',
                    'created_by' => $request->user()->id,
                ]);
            }
        }

        return $this->successResponse($project->load('owner'), 'Project instantiated from scholarly template.', 201);
    }

    /**
     * The template's first recommended stage, when it is one a project can be in; otherwise scoping.
     */
    private function startingStage(ProjectTemplate $template): string
    {
        $first = $template->recommended_stages[0] ?? null;

        return in_array($first, ['scoping', 'collecting', 'analysing', 'writing', 'reviewing', 'completed'], true) ? $first : 'scoping';
    }
}
