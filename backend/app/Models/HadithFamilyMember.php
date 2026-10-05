<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HadithFamilyMember extends Model
{
    protected $table = 'hadith_family_members';

    public $timestamps = false;

    protected $fillable = [
        'family_id',
        'evidence_id',
        'corpus_hadith_id',
        'corpus_sanad_id',
        'relationship_type',
        'convergence_narrator',
        'convergence_depth',
        'scholarly_notes',
        'created_at',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'convergence_depth' => 'integer',
        'corpus_hadith_id' => 'integer',
        'corpus_sanad_id' => 'integer',
    ];

    public function family(): BelongsTo
    {
        return $this->belongsTo(HadithFamily::class, 'family_id');
    }

    public function evidence(): BelongsTo
    {
        return $this->belongsTo(EvidenceItem::class, 'evidence_id');
    }
}
