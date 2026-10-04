<?php

namespace App\Models\Corpus;

use Illuminate\Database\Eloquent\Relations\HasMany;

class CorpusAuthor extends CorpusModel
{
    protected $table = 'authors';

    public function books(): HasMany
    {
        return $this->hasMany(CorpusBook::class, 'author_id');
    }
}
