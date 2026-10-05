<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CollaborationRequest extends Model
{
    protected $table = 'collaboration_requests';

    protected $fillable = [
        'project_id',
        'requester_id',
        'message',
        'contact_email',
        'status',
        'decision_notes',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(ResearchProject::class, 'project_id');
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requester_id');
    }
}
