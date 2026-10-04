<?php

namespace App\Models\Corpus;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CorpusSanad extends CorpusModel
{
    protected $table = 'sanads';

    public function reference(): BelongsTo
    {
        return $this->belongsTo(CorpusHadithReference::class, 'reference_id');
    }

    public function narratorNodes(): HasMany
    {
        return $this->hasMany(CorpusHadithHasNarrator::class, 'sanad_id')->orderBy('id');
    }
}
