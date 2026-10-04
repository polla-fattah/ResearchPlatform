<?php

namespace App\Models\Corpus;

use Illuminate\Database\Eloquent\Relations\HasMany;

class CorpusHadith extends CorpusModel
{
    protected $table = 'hadiths';

    public function references(): HasMany
    {
        return $this->hasMany(CorpusHadithReference::class, 'hadith_id');
    }

    public function clusters(): HasMany
    {
        return $this->hasMany(CorpusHadithCluster::class, 'hadith_id');
    }

    public function reverseClusters(): HasMany
    {
        return $this->hasMany(CorpusHadithCluster::class, 'related_hadith_id');
    }
}
