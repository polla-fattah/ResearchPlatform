<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ResultSetMember extends Model
{
    use HasFactory;

    protected $table = 'result_set_members';

    public $timestamps = false;

    protected $fillable = [
        'result_set_id',
        'resource_type',
        'corpus_id',
        'ordinal_position',
        'snapshot_data',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'ordinal_position' => 'integer',
            'snapshot_data' => 'array',
            'created_at' => 'datetime',
        ];
    }

    public function resultSet(): BelongsTo
    {
        return $this->belongsTo(ResultSet::class, 'result_set_id');
    }
}
