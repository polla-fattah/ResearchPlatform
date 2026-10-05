<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NarratorTrajectory extends Model
{
    protected $table = 'narrator_trajectories';
    public $timestamps = false;

    protected $fillable = [
        'narrator_id',
        'place_id',
        'trajectory_type',
        'year_hijri_start',
        'year_hijri_end',
        'evidence_text',
        'is_inferred',
        'created_at',
    ];

    protected $casts = [
        'is_inferred' => 'boolean',
        'year_hijri_start' => 'integer',
        'year_hijri_end' => 'integer',
        'created_at' => 'datetime',
    ];

    public function place(): BelongsTo
    {
        return $this->belongsTo(GeographicalPlace::class, 'place_id');
    }
}
