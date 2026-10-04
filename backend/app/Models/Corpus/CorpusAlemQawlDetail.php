<?php

namespace App\Models\Corpus;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CorpusAlemQawlDetail extends CorpusModel
{
    protected $table = 'alem_qawl_details';

    public function narrator(): BelongsTo
    {
        return $this->belongsTo(CorpusNarrator::class, 'narrator_id');
    }

    public function scholar(): BelongsTo
    {
        return $this->belongsTo(CorpusNarrator::class, 'alem_id');
    }

    public function book(): BelongsTo
    {
        return $this->belongsTo(CorpusBook::class, 'book_id');
    }

    public function hukm(): BelongsTo
    {
        return $this->belongsTo(CorpusHukm::class, 'hukm_id');
    }
}
