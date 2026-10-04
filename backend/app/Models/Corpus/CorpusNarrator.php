<?php

namespace App\Models\Corpus;

use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CorpusNarrator extends CorpusModel
{
    protected $table = 'narrators';

    public function shyookh(): BelongsToMany
    {
        return $this->belongsToMany(
            CorpusNarrator::class,
            'shyookh',
            'narrator_id',
            'shaykh_id'
        );
    }

    public function students(): BelongsToMany
    {
        return $this->belongsToMany(
            CorpusNarrator::class,
            'students',
            'narrator_id',
            'student_id'
        );
    }

    public function criticisms(): HasMany
    {
        return $this->hasMany(CorpusAlemQawlDetail::class, 'narrator_id');
    }

    public function transmissions(): HasMany
    {
        return $this->hasMany(CorpusHadithHasNarrator::class, 'narrator_id');
    }
}
