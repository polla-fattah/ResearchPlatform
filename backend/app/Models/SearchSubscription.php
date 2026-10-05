<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SearchSubscription extends Model
{
    protected $table = 'search_subscriptions';

    protected $fillable = [
        'project_id',
        'user_id',
        'saved_query_id',
        'frequency',
        'is_active',
        'last_run_at',
        'last_result_count',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'last_run_at' => 'datetime',
        'last_result_count' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(ResearchProject::class, 'project_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function savedQuery(): BelongsTo
    {
        return $this->belongsTo(SavedQuery::class, 'saved_query_id');
    }
}
