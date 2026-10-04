<?php

namespace App\Models\Corpus;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CorpusHadithHasNarrator extends CorpusModel
{
    protected $table = 'hadith_has_narrator';

    public function sanad(): BelongsTo
    {
        return $this->belongsTo(CorpusSanad::class, 'sanad_id');
    }

    public function narrator(): BelongsTo
    {
        return $this->belongsTo(CorpusNarrator::class, 'narrator_id');
    }

    public function toldBy(): BelongsTo
    {
        return $this->belongsTo(CorpusNarrator::class, 'told_by_id');
    }

    public function connectorVariant(): BelongsTo
    {
        return $this->belongsTo(CorpusConnectorVariant::class, 'connector');
    }
}
