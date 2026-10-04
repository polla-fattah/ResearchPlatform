<?php

namespace App\Models\Corpus;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CorpusHadithReference extends CorpusModel
{
    protected $table = 'hadith_references';

    public function hadith(): BelongsTo
    {
        return $this->belongsTo(CorpusHadith::class, 'hadith_id');
    }

    public function book(): BelongsTo
    {
        return $this->belongsTo(CorpusBook::class, 'book_id');
    }

    public function chapter(): BelongsTo
    {
        return $this->belongsTo(CorpusChapter::class, 'chapter_id');
    }

    public function section(): BelongsTo
    {
        return $this->belongsTo(CorpusSection::class, 'section_id');
    }

    public function hukm(): BelongsTo
    {
        return $this->belongsTo(CorpusHukm::class, 'hukm_id');
    }

    public function sanads(): HasMany
    {
        return $this->hasMany(CorpusSanad::class, 'reference_id');
    }
}
