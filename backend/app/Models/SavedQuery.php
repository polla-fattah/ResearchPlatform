<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SavedQuery extends Model
{
    use HasFactory;

    protected $table = 'saved_queries';

    protected $fillable = [
        'owner_type',
        'owner_id',
        'name',
        'query_text',
        'search_mode',
        'filter_criteria',
    ];

    protected function casts(): array
    {
        return [
            'filter_criteria' => 'array',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(ResearchProject::class, 'owner_id');
    }

    public function searchRuns(): HasMany
    {
        return $this->hasMany(SearchRun::class, 'saved_query_id');
    }
}
