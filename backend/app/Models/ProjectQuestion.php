<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProjectQuestion extends Model
{
    use HasFactory;

    protected $table = 'project_questions';

    protected $fillable = [
        'project_id',
        'text',
        'linked_evidence_ids',
        'resolved',
    ];

    protected function casts(): array
    {
        return [
            'linked_evidence_ids' => 'array',
            'resolved' => 'boolean',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(ResearchProject::class, 'project_id');
    }
}
