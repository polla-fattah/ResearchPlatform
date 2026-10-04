<?php

namespace App\Models\Corpus;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CorpusBook extends CorpusModel
{
    protected $table = 'books';

    public function author(): BelongsTo
    {
        return $this->belongsTo(CorpusAuthor::class, 'author_id');
    }

    public function chapters(): HasMany
    {
        return $this->hasMany(CorpusChapter::class, 'book_id')->orderBy('sort_order');
    }

    public function references(): HasMany
    {
        return $this->hasMany(CorpusHadithReference::class, 'book_id');
    }
}
