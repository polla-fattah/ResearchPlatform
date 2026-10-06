<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class EvidenceItem extends Model
{
    use HasFactory;

    protected $table = 'evidence_items';

    protected $fillable = [
        'project_id',
        'resource_id',
        'captured_text',
        'locator',
        'source_version',
        'content_hash',
        'state',
        'state_reason',
        'exclusion_reason',
        'collector_id',
    ];

    protected $appends = ['state_reason'];

    public function getStateReasonAttribute(): ?string
    {
        return $this->attributes['exclusion_reason'] ?? null;
    }

    public function setStateReasonAttribute(?string $val): void
    {
        $this->attributes['exclusion_reason'] = $val;
    }

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

    public function resource(): BelongsTo
    {
        return $this->belongsTo(Resource::class, 'resource_id');
    }

    public function collector(): BelongsTo
    {
        return $this->belongsTo(User::class, 'collector_id');
    }

    public function annotations(): HasMany
    {
        return $this->hasMany(Annotation::class, 'target_id')
                    ->where('target_type', 'evidence');
    }

    public function findings(): BelongsToMany
    {
        return $this->belongsToMany(Finding::class, 'finding_evidence', 'evidence_id', 'finding_id')
                    ->withPivot('relation_type', 'interpretation', 'created_at');
    }
}
