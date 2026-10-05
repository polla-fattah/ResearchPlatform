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
        'mfa_secret',
        'recovery_codes',
        'display_preferences',
        'roles',
    ];

    protected $hidden = [
        'mfa_secret',
        'recovery_codes',
    ];

    protected $casts = [
        'research_interests' => 'array',
        'is_public' => 'boolean',
        'public_fields' => 'array',
        'mfa_secret' => 'encrypted',
        'recovery_codes' => 'array',
        'display_preferences' => 'array',
        'roles' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
