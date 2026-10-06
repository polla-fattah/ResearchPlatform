<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LibraryItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'resource_id',
        'is_favourite',
        'personal_notes',
        'locator',
        'excerpt_text',
        'snapshot_data',
        'snapshot_corpus_version',
        'source_status',
        'merged_into',
        'incomplete_citation_flags',
        'tags',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'is_favourite' => 'boolean',
            'snapshot_data' => 'array',
            'incomplete_citation_flags' => 'array',
            'tags' => 'array',
            'notes' => 'array',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function resource(): BelongsTo
    {
        return $this->belongsTo(Resource::class);
    }
}
