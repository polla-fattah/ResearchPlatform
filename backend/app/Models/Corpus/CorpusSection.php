<?php

namespace App\Models\Corpus;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CorpusSection extends CorpusModel
{
    protected $table = 'sections';

    public function chapter(): BelongsTo
    {
        return $this->belongsTo(CorpusChapter::class, 'chapter_id');
    }
}
