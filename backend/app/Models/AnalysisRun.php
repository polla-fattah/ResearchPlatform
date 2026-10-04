<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AnalysisRun extends Model
{
    use HasFactory;

    protected $table = 'analysis_runs';

    public $timestamps = false;

    protected $fillable = [
        'project_id',
        'analysis_type',
        'input_params',
        'output_data',
        'version_number',
        'created_by',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'input_params' => 'array',
            'output_data' => 'array',
            'version_number' => 'integer',
            'created_at' => 'datetime',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(ResearchProject::class, 'project_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
