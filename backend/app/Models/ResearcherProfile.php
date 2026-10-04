<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ResearcherProfile extends Model
{
    protected $fillable = [
        'user_id',
        'affiliation',
        'biography',
        'research_interests',
        'is_public',
        'public_fields',
    ];

    protected $casts = [
        'research_interests' => 'array',
        'is_public' => 'boolean',
        'public_fields' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
