<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Resource extends Model
{
    use HasFactory;

    protected $fillable = [
        'resource_type',
        'corpus_table',
        'corpus_id',
        'title',
        'author',
        'source_metadata',
        'rights_status',
        'provenance',
    ];

    protected function casts(): array
    {
        return [
            'source_metadata' => 'array',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function libraryItems(): HasMany
    {
        return $this->hasMany(LibraryItem::class);
    }

    public function collections(): BelongsToMany
    {
        return $this->belongsToMany(ResourceCollection::class, 'collection_resources', 'resource_id', 'collection_id')
                    ->withPivot('created_at');
    }

    public function projects(): BelongsToMany
    {
        return $this->belongsToMany(ResearchProject::class, 'project_resources', 'resource_id', 'project_id')
                    ->withPivot('added_by', 'inclusion_rationale')
                    ->withTimestamps();
    }
}
