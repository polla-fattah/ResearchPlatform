<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    // A person may keep several distinct excerpts of one source: the same source with the same excerpt is still one item.
    public function up(): void
    {
        DB::statement('ALTER TABLE library_items DROP CONSTRAINT IF EXISTS uq_user_resource');
        DB::statement("CREATE UNIQUE INDEX IF NOT EXISTS uq_user_resource_excerpt ON library_items (user_id, resource_id, md5(coalesce(excerpt_text, '')))");
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS uq_user_resource_excerpt');
        DB::statement('ALTER TABLE library_items ADD CONSTRAINT uq_user_resource UNIQUE (user_id, resource_id)');
    }
};
