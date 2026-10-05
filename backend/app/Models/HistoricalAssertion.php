<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HistoricalAssertion extends Model
{
    protected $table = 'historical_assertions';

    protected $fillable = [
        'project_id',
        'subject_type',
        'subject_id',
        'subject_name',
        'assertion_claim',
        'uncertainty_level',
        'competing_alternatives',
        'adjudication_notes',
        'created_by',
    ];

    protected $casts = [
        'competing_alternatives' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(ResearchProject::class, 'project_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
