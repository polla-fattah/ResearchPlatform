<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class GenerateApiDocs extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'docs:generate';

    /**
     * The console command description.
     */
    protected $description = 'Generate OpenAPI 3.1 specification, Postman collection, and Bruno API collection for all 12 modules';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info("Building OpenAPI 3.1, Postman, and Bruno API specifications...");

        $scriptPath = base_path('scripts/build_api_docs.php');
        if (file_exists($scriptPath)) {
            require $scriptPath;
        }

        $this->info("✓ OpenAPI 3.1 JSON: docs/api/openapi.json & public/docs/openapi.json");
        $this->info("✓ Postman Collection: docs/api/OpenHadith_Platform.postman_collection.json");
        $this->info("✓ Bruno Collection: docs/api/bruno/");
        $this->info("✓ Interactive Browser Docs: http://127.0.0.1:8000/docs");

        return Command::SUCCESS;
    }
}
