<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class ResearchProject extends Model
{
    protected $fillable = [
        'owner_id',
        'title',
        'question',
        'scope',
        'primary_language',
        'stage',
        'is_archived',
        'archived_at',
        'is_deleted',
        'deleted_at',
        'recovery_deadline',
        'tags',
        'languages',
    ];

    protected $casts = [
        'is_archived' => 'boolean',
        'is_deleted' => 'boolean',
        'archived_at' => 'datetime',
        'deleted_at' => 'datetime',
        'recovery_deadline' => 'datetime',
        'tags' => 'array',
        'languages' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function memberships(): HasMany
    {
        return $this->hasMany(ProjectMembership::class, 'project_id');
    }

    public function resources(): BelongsToMany
    {
        return $this->belongsToMany(Resource::class, 'project_resources', 'project_id', 'resource_id')
                    ->withPivot('added_by', 'inclusion_rationale', 'tags')
                    ->withTimestamps();
    }

    public function evidenceItems(): HasMany
    {
        return $this->hasMany(EvidenceItem::class, 'project_id');
    }

    public function findings(): HasMany
    {
        return $this->hasMany(Finding::class, 'project_id');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(Document::class, 'project_id');
    }

    public function milestones(): HasMany
    {
        return $this->hasMany(ProjectMilestone::class, 'project_id');
    }

    public function questions(): HasMany
    {
        return $this->hasMany(ProjectQuestion::class, 'project_id');
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class, 'project_id');
    }

    public function savedQueries(): HasMany
    {
        return $this->hasMany(SavedQuery::class, 'owner_id')->where('owner_type', 'project');
    }

    public function resultSets(): HasMany
    {
        return $this->hasMany(ResultSet::class, 'project_id');
    }

    public function analyses(): HasMany
    {
        return $this->hasMany(AnalysisRun::class, 'project_id');
    }
}
