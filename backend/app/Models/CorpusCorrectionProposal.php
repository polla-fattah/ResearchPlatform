<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CorpusCorrectionProposal extends Model
{
    use HasFactory;

    protected $table = 'corpus_correction_proposals';

    public $timestamps = false;

    protected $fillable = [
        'researcher_id',
        'corpus_table',
        'corpus_id',
        'current_value',
        'proposed_value',
        'evidence_notes',
        'status',
        'decided_by',
        'decided_at',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'decided_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }

    public function researcher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'researcher_id');
    }

    public function decider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by');
    }
}
