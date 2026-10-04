<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ResultSet extends Model
{
    use HasFactory;

    protected $table = 'result_sets';

    public $timestamps = false;

    protected $fillable = [
        'project_id',
        'search_run_id',
        'name',
        'is_frozen',
        'total_count',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'is_frozen' => 'boolean',
            'total_count' => 'integer',
            'created_at' => 'datetime',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(ResearchProject::class, 'project_id');
    }

    public function searchRun(): BelongsTo
    {
        return $this->belongsTo(SearchRun::class, 'search_run_id');
    }

    public function members(): HasMany
    {
        return $this->hasMany(ResultSetMember::class, 'result_set_id')->orderBy('ordinal_position');
    }
}
