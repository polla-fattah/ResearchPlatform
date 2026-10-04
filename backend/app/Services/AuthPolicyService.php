<?php

namespace App\Services;

use App\Models\User;
use App\Models\ResearchProject;
use App\Models\ProjectMembership;
use Illuminate\Auth\Access\AuthorizationException;

class AuthPolicyService
{
    /**
     * Role hierarchy weights
     */
    private const ROLE_WEIGHTS = [
        'owner' => 100,
        'researcher' => 70,
        'reviewer' => 40,
        'viewer' => 20,
    ];

    /**
     * Check if user can perform an action on a project.
     */
    public function canAccessProject(?User $user, string $action, ResearchProject $project): bool
    {
        if (!$user) {
            return false;
        }

        // Suspended accounts have zero write/access permissions
        if ($user->status === 'suspended') {
            return false;
        }

        // Project Owner always has access
        if ($project->owner_id === $user->id) {
            return true;
        }

        // Retrieve membership
        $membership = ProjectMembership::where('project_id', $project->id)
            ->where('user_id', $user->id)
            ->where('status', 'accepted')
            ->first();

        if (!$membership) {
            return false;
        }

        return match ($action) {
            'view', 'read' => true,
            'comment', 'discuss' => in_array($membership->role, ['owner', 'co_investigator', 'researcher', 'contributor', 'reviewer']),
            'resolve_dispute' => in_array($membership->role, ['owner', 'co_investigator', 'researcher']),
            'manage_tasks' => in_array($membership->role, ['owner', 'co_investigator', 'researcher', 'contributor']),
            'edit', 'create_evidence', 'write_document', 'acquire_lock' => in_array($membership->role, ['owner', 'co_investigator', 'researcher', 'contributor']),
            'manage_members', 'invite', 'archive', 'delete', 'publish_announcement', 'submit_publication' => in_array($membership->role, ['owner', 'co_investigator']),
            default => false,
        };
    }

    /**
     * Enforce access or throw 403 AuthorizationException.
     */
    public function authorizeProject(?User $user, string $action, ResearchProject $project): void
    {
        if (!$this->canAccessProject($user, $action, $project)) {
            throw new AuthorizationException("You are not authorized to perform [{$action}] on this project.");
        }
    }
}
