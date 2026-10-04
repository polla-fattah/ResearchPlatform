<?php

namespace App\Models\Corpus;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CorpusHadithCluster extends CorpusModel
{
    protected $table = 'hadith_clusters';

    public function hadith(): BelongsTo
    {
        return $this->belongsTo(CorpusHadith::class, 'hadith_id');
    }

    public function relatedHadith(): BelongsTo
    {
        return $this->belongsTo(CorpusHadith::class, 'related_hadith_id');
    }
}
