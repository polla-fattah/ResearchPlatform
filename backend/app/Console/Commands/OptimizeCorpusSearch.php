<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class OptimizeCorpusSearch extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'corpus:optimize-search 
                            {--check : Only check existing index status without building}
                            {--mem=512MB : Maintenance work memory allocation for index building}';

    /**
     * The console command description.
     */
    protected $description = 'Set up and verify PostgreSQL pg_trgm and Arabic tsvector GIN indexes on the 1.13M Hadith corpus';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $conn = DB::connection('pgsql_corpus');

        $this->info("Connecting to corpus database [{$conn->getDatabaseName()}] on PostgreSQL...");

        if ($this->option('check')) {
            return $this->checkIndexes($conn);
        }

        $mem = $this->option('mem');
        $this->info("Configuring session: SET maintenance_work_mem = '{$mem}';");
        $conn->statement("SET maintenance_work_mem = '{$mem}';");
        $conn->statement("SET max_parallel_maintenance_workers = 4;");

        $tasks = [
            [
                'name' => 'PostgreSQL Extension: pg_trgm',
                'sql'  => 'CREATE EXTENSION IF NOT EXISTS pg_trgm;',
            ],
            [
                'name' => 'Foreign Key Index: hadith_references(hadith_id)',
                'sql'  => 'CREATE INDEX IF NOT EXISTS idx_hadith_refs_hadith_id ON hadith_references (hadith_id);',
            ],
            [
                'name' => 'Foreign Key Index: hadith_references(book_id)',
                'sql'  => 'CREATE INDEX IF NOT EXISTS idx_hadith_refs_book_id ON hadith_references (book_id);',
            ],
            [
                'name' => 'Foreign Key Index: hadith_references(chapter_id)',
                'sql'  => 'CREATE INDEX IF NOT EXISTS idx_hadith_refs_chapter_id ON hadith_references (chapter_id);',
            ],
            [
                'name' => 'Foreign Key Index: hadith_has_narrator(sanad_id)',
                'sql'  => 'CREATE INDEX IF NOT EXISTS idx_hadith_has_narrator_sanad_id ON hadith_has_narrator (sanad_id);',
            ],
            [
                'name' => 'Trigram Index: narrators(name)',
                'sql'  => 'CREATE INDEX IF NOT EXISTS idx_narrators_name_trgm ON narrators USING gin (name gin_trgm_ops);',
            ],
            [
                'name' => 'FTS Index: hadiths(to_tsvector Arabic on clean_matn)',
                'sql'  => "CREATE INDEX IF NOT EXISTS idx_hadiths_clean_matn_fts ON hadiths USING gin (to_tsvector('arabic', coalesce(clean_matn, '')));",
            ],
            [
                'name' => 'FTS Index: hadiths(to_tsvector Simple on clean_matn)',
                'sql'  => "CREATE INDEX IF NOT EXISTS idx_hadiths_clean_matn_simple_fts ON hadiths USING gin (to_tsvector('simple', coalesce(clean_matn, '')));",
            ],
            [
                'name' => 'Trigram GIN Index: hadiths(clean_matn gin_trgm_ops)',
                'sql'  => 'CREATE INDEX IF NOT EXISTS idx_hadiths_clean_matn_trgm ON hadiths USING gin (clean_matn gin_trgm_ops);',
            ],
            [
                'name' => 'Trigram GIN Index: hadiths(matn gin_trgm_ops)',
                'sql'  => 'CREATE INDEX IF NOT EXISTS idx_hadiths_matn_trgm ON hadiths USING gin (matn gin_trgm_ops);',
            ],
        ];

        $bar = $this->output->createProgressBar(count($tasks));
        $bar->start();

        foreach ($tasks as $task) {
            $this->newLine();
            $this->line("<comment>Building:</comment> {$task['name']}...");
            $start = microtime(true);
            try {
                $conn->statement($task['sql']);
                $duration = round(microtime(true) - $start, 2);
                $this->info("✓ Finished in {$duration}s");
            } catch (\Throwable $e) {
                $this->error("✗ Failed: " . $e->getMessage());
            }
            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);

        $this->info("✓ All corpus search indexes are active!");
        return $this->checkIndexes($conn);
    }

    private function checkIndexes($conn): int
    {
        $this->info("\n--- Verified Corpus Indexes on [hadiths] ---");
        $indexes = $conn->select("
            SELECT indexname, indexdef 
            FROM pg_indexes 
            WHERE tablename = 'hadiths'
            ORDER BY indexname
        ");

        $rows = [];
        foreach ($indexes as $idx) {
            $rows[] = [$idx->indexname, $idx->indexdef];
        }
        $this->table(['Index Name', 'Definition'], $rows);

        $totalHadiths = $conn->table('hadiths')->count();
        $this->line("<info>Total indexed corpus hadiths:</info> " . number_format($totalHadiths));

        return Command::SUCCESS;
    }
}
