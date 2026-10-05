<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ArgumentEdge extends Model
{
    protected $table = 'argument_edges';
    public $timestamps = false;

    protected $fillable = [
        'project_id',
        'source_node_id',
        'target_node_id',
        'relation_type',
        'notes',
        'created_at',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(ResearchProject::class, 'project_id');
    }

    public function sourceNode(): BelongsTo
    {
        return $this->belongsTo(ArgumentNode::class, 'source_node_id');
    }

    public function targetNode(): BelongsTo
    {
        return $this->belongsTo(ArgumentNode::class, 'target_node_id');
    }
}
