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
    ];

    protected $casts = [
        'is_archived' => 'boolean',
        'is_deleted' => 'boolean',
        'archived_at' => 'datetime',
        'deleted_at' => 'datetime',
        'recovery_deadline' => 'datetime',
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
}
