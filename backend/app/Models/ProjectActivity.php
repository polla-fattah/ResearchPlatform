<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProjectActivity extends Model
{
    use HasFactory;

    protected $table = 'project_activities';

    public $timestamps = false; // Only created_at in schema

    protected $fillable = [
        'project_id',
        'actor_id',
        'action',
        'object_type',
        'object_id',
        'summary',
        'created_at',
    ];

    /**
     * Put one entry in a project's activity feed.
     */
    public static function record(int $projectId, int $actorId, string $action, string $objectType, int $objectId, string $summary): self
    {
        return self::create([
            'project_id' => $projectId,
            'actor_id' => $actorId,
            'action' => $action,
            'object_type' => $objectType,
            'object_id' => $objectId,
            'summary' => $summary,
            'created_at' => now(),
        ]);
    }

    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(ResearchProject::class, 'project_id');
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
