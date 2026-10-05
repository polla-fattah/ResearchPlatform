<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class GeographicalPlace extends Model
{
    protected $table = 'geographical_places';
    public $timestamps = false;

    protected $fillable = [
        'canonical_name_ar',
        'canonical_name_en',
        'region',
        'latitude',
        'longitude',
        'historical_notes',
        'created_at',
    ];

    protected $casts = [
        'latitude' => 'float',
        'longitude' => 'float',
        'created_at' => 'datetime',
    ];

    public function trajectories(): HasMany
    {
        return $this->hasMany(NarratorTrajectory::class, 'place_id');
    }
}
