<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReviewAssignment extends Model
{
    use HasFactory;

    protected $table = 'review_assignments';

    public $timestamps = false;

    protected $fillable = [
        'submission_id',
        'reviewer_id',
        'status',
        'recommendation',
        'score',
        'reviewer_notes',
        'declined_reason',
        'declined_at',
        'coi_confirmed',
        'due_date',
        'completed_at',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'score' => 'integer',
            'coi_confirmed' => 'boolean',
            'due_date' => 'datetime',
            'completed_at' => 'datetime',
            'declined_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }

    public function submission(): BelongsTo
    {
        return $this->belongsTo(Submission::class, 'submission_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewer_id');
    }
}
