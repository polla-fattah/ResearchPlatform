<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Citation extends Model
{
    use HasFactory;

    protected $table = 'citations';

    public $timestamps = false;

    protected $fillable = [
        'document_version_id',
        'evidence_id',
        'resource_id',
        'locator',
        'citation_type',
        'formatted_citation',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
        ];
    }

    public function documentVersion(): BelongsTo
    {
        return $this->belongsTo(DocumentVersion::class, 'document_version_id');
    }

    public function evidence(): BelongsTo
    {
        return $this->belongsTo(EvidenceItem::class, 'evidence_id');
    }

    public function resource(): BelongsTo
    {
        return $this->belongsTo(Resource::class, 'resource_id');
    }
}
