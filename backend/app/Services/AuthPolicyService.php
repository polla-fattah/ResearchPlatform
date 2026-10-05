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

        // Trashed projects are read-only except restore
        if ($project->is_deleted && !in_array($action, ['view', 'read', 'restore'])) {
            return false;
        }

        // Project Owner always has access
        if ($project->owner_id === $user->id) {
            return true;
        }

        // Active support grant allows administrative support view/read access
        if ($user->is_admin && in_array($action, ['view', 'read'])) {
            $hasActiveGrant = \App\Models\SupportGrant::where('admin_id', $user->id)
                ->where('object_id', $project->id)
                ->where('scope', 'project')
                ->where('expires_at', '>', now())
                ->exists();
            if ($hasActiveGrant) {
                return true;
            }
        }

        // Retrieve membership
        $membership = ProjectMembership::where('project_id', $project->id)
            ->where('user_id', $user->id)
            ->where('status', 'accepted')
            ->first();

        if (!$membership) {
            return false;
        }

        // Map legacy roles to canonical SRS roles
        $role = match ($membership->role) {
            'co_investigator', 'contributor' => 'researcher',
            'observer' => 'viewer',
            default => $membership->role,
        };

        return match ($action) {
            'view', 'read' => true,
            'comment', 'discuss' => in_array($role, ['owner', 'researcher', 'reviewer']),
            'resolve_dispute' => in_array($role, ['owner', 'researcher']),
            'manage_tasks' => in_array($role, ['owner', 'researcher']),
            'edit', 'create_evidence', 'write_document', 'acquire_lock' => in_array($role, ['owner', 'researcher']),
            'manage_members', 'invite', 'archive', 'delete', 'publish_announcement', 'submit_publication' => $role === 'owner',
            default => false,
        };
    }

    /**
     * Enforce access or throw 404 (if not member) or 403 (if member lacks action permission).
     * This prevents existence disclosure of private projects (DEF-2).
     */
    public function authorizeProject(?User $user, string $action, ResearchProject $project): void
    {
        if (!$user) {
            throw new \Symfony\Component\HttpKernel\Exception\NotFoundHttpException("Project not found.");
        }

        if ($user->status === 'suspended') {
            throw new AuthorizationException("Your account is suspended.");
        }

        if ($project->is_deleted && !in_array($action, ['view', 'read', 'restore'])) {
            throw new AuthorizationException("Project is currently in trash and is read-only.");
        }

        if ($project->owner_id === $user->id) {
            return;
        }

        if ($user->is_admin && in_array($action, ['view', 'read'])) {
            $hasActiveGrant = \App\Models\SupportGrant::where('admin_id', $user->id)
                ->where('object_id', $project->id)
                ->where('scope', 'project')
                ->where('expires_at', '>', now())
                ->exists();
            if ($hasActiveGrant) {
                return;
            }
        }

        $membership = ProjectMembership::where('project_id', $project->id)
            ->where('user_id', $user->id)
            ->where('status', 'accepted')
            ->first();

        // If user is not a member, return 404 to avoid disclosing project existence (DEF-2)
        if (!$membership) {
            throw new \Symfony\Component\HttpKernel\Exception\NotFoundHttpException("Project not found.");
        }

        if (!$this->canAccessProject($user, $action, $project)) {
            throw new AuthorizationException("You are not authorized to perform [{$action}] on this project.");
        }
    }

    /**
     * Get role to capabilities matrix (API-11, SRS §3.2).
     */
    public function getRoleCapabilities(): array
    {
        return [
            'owner' => [
                'view' => true,
                'comment' => true,
                'edit' => true,
                'manage_tasks' => true,
                'resolve_dispute' => true,
                'manage_members' => true,
                'publish' => true,
                'archive' => true,
                'delete' => true,
                'transfer' => true,
            ],
            'researcher' => [
                'view' => true,
                'comment' => true,
                'edit' => true,
                'manage_tasks' => true,
                'resolve_dispute' => true,
                'manage_members' => false,
                'publish' => false,
                'archive' => false,
                'delete' => false,
                'transfer' => false,
            ],
            'reviewer' => [
                'view' => true,
                'comment' => true,
                'edit' => false,
                'manage_tasks' => false,
                'resolve_dispute' => false,
                'manage_members' => false,
                'publish' => false,
                'archive' => false,
                'delete' => false,
                'transfer' => false,
            ],
            'viewer' => [
                'view' => true,
                'comment' => false,
                'edit' => false,
                'manage_tasks' => false,
                'resolve_dispute' => false,
                'manage_members' => false,
                'publish' => false,
                'archive' => false,
                'delete' => false,
                'transfer' => false,
            ],
        ];
    }
}
