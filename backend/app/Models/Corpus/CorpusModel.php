<?php

namespace App\Models\Corpus;

use Illuminate\Database\Eloquent\Model;

abstract class CorpusModel extends Model
{
    /**
     * The database connection name for the classical Hadith corpus.
     */
    protected $connection = 'pgsql_corpus';

    /**
     * Corpus is strictly read-only for research platform operations.
     */
    public $timestamps = false;
}
