<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // A visitor who is not signed in can send interest from a public announcement, so a request may have no requester.
    public function up(): void
    {
        if (Schema::hasTable('collaboration_requests') && Schema::hasColumn('collaboration_requests', 'requester_id')) {
            DB::statement('ALTER TABLE collaboration_requests ALTER COLUMN requester_id DROP NOT NULL');
        }
    }

    public function down(): void
    {
        // Left nullable: rows without a requester may exist.
    }
};
