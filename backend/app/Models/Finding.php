<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Finding extends Model
{
    use HasFactory;

    protected $table = 'findings';

    protected $fillable = [
        'project_id',
        'question',
        'claim',
        'reasoning',
        'limitations',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(ResearchProject::class, 'project_id');
    }

    public function evidenceItems(): BelongsToMany
    {
        return $this->belongsToMany(EvidenceItem::class, 'finding_evidence', 'finding_id', 'evidence_id')
                    ->withPivot('relation_type', 'interpretation', 'created_at');
    }

    public function documents(): BelongsToMany
    {
        return $this->belongsToMany(Document::class, 'document_findings', 'finding_id', 'document_id')->withTimestamps();
    }
}
