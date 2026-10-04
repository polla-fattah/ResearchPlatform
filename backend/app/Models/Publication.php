<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Publication extends Model
{
    use HasFactory;

    protected $table = 'publications';

    protected $fillable = [
        'project_id',
        'submission_id',
        'public_slug',
        'doi',
        'title',
        'abstract',
        'published_content',
        'version_string',
        'license',
        'status',
        'retraction_reason',
        'retracted_at',
        'corrigenda',
        'released_by',
        'released_at',
    ];

    protected function casts(): array
    {
        return [
            'published_content' => 'array',
            'corrigenda' => 'array',
            'retracted_at' => 'datetime',
            'released_at' => 'datetime',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(ResearchProject::class, 'project_id');
    }

    public function submission(): BelongsTo
    {
        return $this->belongsTo(Submission::class, 'submission_id');
    }

    public function releaser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'released_by');
    }
}
