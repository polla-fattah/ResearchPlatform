<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Submission extends Model
{
    use HasFactory;

    protected $table = 'submissions';

    protected $fillable = [
        'project_id',
        'parent_submission_id',
        'version_number',
        'title',
        'abstract',
        'keywords',
        'rights_declaration',
        'coi_declared',
        'author_response_notes',
        'frozen_package',
        'package_checksum',
        'status',
        'submitted_by',
        'submitted_at',
    ];

    protected function casts(): array
    {
        return [
            'frozen_package' => 'array',
            'keywords' => 'array',
            'coi_declared' => 'boolean',
            'version_number' => 'integer',
            'submitted_at' => 'datetime',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(ResearchProject::class, 'project_id');
    }

    public function parentSubmission(): BelongsTo
    {
        return $this->belongsTo(Submission::class, 'parent_submission_id');
    }

    public function revisions(): HasMany
    {
        return $this->hasMany(Submission::class, 'parent_submission_id');
    }

    public function submitter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(ReviewAssignment::class, 'submission_id');
    }

    public function decision(): HasOne
    {
        return $this->hasOne(EditorialDecision::class, 'submission_id');
    }

    public function publication(): HasOne
    {
        return $this->hasOne(Publication::class, 'submission_id');
    }
}
