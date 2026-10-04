<?php

namespace App\Models\Corpus;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CorpusChapter extends CorpusModel
{
    protected $table = 'chapters';

    public function book(): BelongsTo
    {
        return $this->belongsTo(CorpusBook::class, 'book_id');
    }

    public function sections(): HasMany
    {
        return $this->hasMany(CorpusSection::class, 'chapter_id')->orderBy('sort_order');
    }
}
