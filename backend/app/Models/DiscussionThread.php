<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class DiscussionThread extends Model
{
    use HasFactory;

    protected $table = 'discussion_threads';

    protected $fillable = [
        'project_id',
        'thread_type',
        'target_type',
        'target_id',
        'title',
        'context_quote',
        'context_locator',
        'alternative_interpretation',
        'is_resolved',
        'resolution_notes',
        'resolved_by',
        'resolved_at',
    ];

    protected function casts(): array
    {
        return [
            'is_resolved' => 'boolean',
            'resolved_at' => 'datetime',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(ResearchProject::class, 'project_id');
    }

    public function resolver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }

    /**
     * The comment that opened the thread; its author is who opened the discussion.
     */
    public function firstComment(): HasOne
    {
        return $this->hasOne(Comment::class, 'thread_id')->oldestOfMany();
    }

    public function comments(): HasMany
    {
        return $this->hasMany(Comment::class, 'thread_id')->orderBy('created_at');
    }
}
