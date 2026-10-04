<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\Pivot;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FindingEvidence extends Pivot
{
    protected $table = 'finding_evidence';

    public $timestamps = false;

    protected $fillable = [
        'finding_id',
        'evidence_id',
        'relation_type',
        'interpretation',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
        ];
    }

    public function finding(): BelongsTo
    {
        return $this->belongsTo(Finding::class, 'finding_id');
    }

    public function evidence(): BelongsTo
    {
        return $this->belongsTo(EvidenceItem::class, 'evidence_id');
    }
}
