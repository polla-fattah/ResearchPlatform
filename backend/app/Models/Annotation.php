<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Annotation extends Model
{
    use HasFactory;

    protected $table = 'annotations';

    protected $fillable = [
        'author_id',
        'target_type',
        'target_id',
        'span_start',
        'span_end',
        'annotation_kind',
        'visibility',
        'body',
        'attributed_to',
        'source_locator',
    ];

    protected function casts(): array
    {
        return [
            'span_start' => 'integer',
            'span_end' => 'integer',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }
}
