<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ArgumentNode extends Model
{
    use SoftDeletes;

    protected $table = 'argument_nodes';

    protected $fillable = [
        'project_id',
        'node_type',
        'title',
        'content',
        'evidence_id',
        'finding_id',
        'order_index',
        'created_by',
    ];

    protected $casts = [
        'order_index' => 'integer',
        'deleted_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(ResearchProject::class, 'project_id');
    }

    public function evidence(): BelongsTo
    {
        return $this->belongsTo(EvidenceItem::class, 'evidence_id');
    }

    public function finding(): BelongsTo
    {
        return $this->belongsTo(Finding::class, 'finding_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function outgoingEdges(): HasMany
    {
        return $this->hasMany(ArgumentEdge::class, 'source_node_id');
    }

    public function incomingEdges(): HasMany
    {
        return $this->hasMany(ArgumentEdge::class, 'target_node_id');
    }
}
