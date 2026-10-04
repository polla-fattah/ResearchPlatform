<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SearchRun extends Model
{
    use HasFactory;

    protected $table = 'search_runs';

    public $timestamps = false;

    protected $fillable = [
        'saved_query_id',
        'corpus_version',
        'match_count',
        'status',
        'execution_duration_ms',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'match_count' => 'integer',
            'execution_duration_ms' => 'integer',
            'created_at' => 'datetime',
        ];
    }

    public function savedQuery(): BelongsTo
    {
        return $this->belongsTo(SavedQuery::class, 'saved_query_id');
    }

    public function resultSets(): HasMany
    {
        return $this->hasMany(ResultSet::class, 'search_run_id');
    }
}
