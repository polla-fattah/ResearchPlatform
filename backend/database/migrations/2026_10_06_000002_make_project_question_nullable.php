<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE research_projects ALTER COLUMN question DROP NOT NULL;');
        DB::statement('ALTER TABLE export_jobs ALTER COLUMN progress TYPE text USING progress::text;');
    }

    public function down(): void
    {
        DB::statement("UPDATE research_projects SET question = 'Not specified' WHERE question IS NULL;");
        DB::statement('ALTER TABLE research_projects ALTER COLUMN question SET NOT NULL;');
    }
};
