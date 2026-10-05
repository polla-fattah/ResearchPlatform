<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\HasMany;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'display_name',
        'email',
        'password',
        'preferred_language',
        'status',
        'is_admin',
        'password_reset_token',
        'password_reset_expires_at',
        'closure_requested_at',
        'closure_reason',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'password_reset_token',
        'password_reset_expires_at',
        'closure_requested_at',
        'closure_reason',
    ];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'is_admin' => 'boolean',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    protected $appends = [
        'roles',
        'mfa_enabled',
    ];

    public function getRolesAttribute(): array
    {
        $roles = [];
        if ($this->is_admin) {
            $roles[] = 'admin';
            $roles[] = 'editor';
            $roles[] = 'corpus_editor';
        }
        if ($this->status === 'approved') {
            $roles[] = 'researcher';
        }
        $stored = $this->profile?->roles ?? [];
        if (is_array($stored)) {
            $roles = array_merge($roles, $stored);
        }
        if (empty($roles)) {
            $roles[] = 'applicant';
        }
        return array_values(array_unique($roles));
    }

    public function getMfaEnabledAttribute(): bool
    {
        return !empty($this->profile?->mfa_secret);
    }

    public function profile(): HasOne
    {
        return $this->hasOne(ResearcherProfile::class);
    }

    public function applications(): HasMany
    {
        return $this->hasMany(ResearcherApplication::class);
    }

    public function ownedProjects(): HasMany
    {
        return $this->hasMany(ResearchProject::class, 'owner_id');
    }

    public function memberships(): HasMany
    {
        return $this->hasMany(ProjectMembership::class);
    }

    public function libraryItems(): HasMany
    {
        return $this->hasMany(LibraryItem::class);
    }

    public function reviewAssignments(): HasMany
    {
        return $this->hasMany(ReviewAssignment::class, 'reviewer_id');
    }
}
