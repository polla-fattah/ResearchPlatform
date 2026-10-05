<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ResearcherApplication extends Model
{
    protected $fillable = [
        'user_id',
        'status',
        'research_statement',
        'sample_publications',
        'reference',
        'information_request',
        'decision_reason',
        'decided_by',
        'decided_at',
    ];

    protected $casts = [
        'information_request' => 'array',
        'decided_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by');
    }

    public function replies(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(ApplicationReply::class, 'application_id');
    }
}
