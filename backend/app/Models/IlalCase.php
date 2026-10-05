<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IlalCase extends Model
{
    protected $table = 'ilal_cases';

    protected $fillable = [
        'project_id',
        'title',
        'discrepancy_category',
        'competing_variants',
        'critics_judgments',
        'preferred_version',
        'status',
        'resolution_notes',
        'created_by',
    ];

    protected $casts = [
        'competing_variants' => 'array',
        'critics_judgments' => 'array',
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
