<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EditorialDecision extends Model
{
    use HasFactory;

    protected $table = 'editorial_decisions';

    public $timestamps = false;

    protected $fillable = [
        'submission_id',
        'editor_id',
        'decision',
        'decision_notes',
        'coi_confirmed',
        'decided_at',
    ];

    protected function casts(): array
    {
        return [
            'coi_confirmed' => 'boolean',
            'decided_at' => 'datetime',
        ];
    }

    public function submission(): BelongsTo
    {
        return $this->belongsTo(Submission::class, 'submission_id');
    }

    public function editor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'editor_id');
    }
}
