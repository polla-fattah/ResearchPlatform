<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class ResourceCollection extends Model
{
    use HasFactory;

    protected $table = 'resource_collections';

    protected $fillable = [
        'owner_type',
        'owner_id',
        'name',
        'description',
    ];

    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function resources(): BelongsToMany
    {
        return $this->belongsToMany(Resource::class, 'collection_resources', 'collection_id', 'resource_id')
                    ->withPivot('created_at');
    }
}
