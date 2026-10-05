<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::table('project_memberships')
            ->whereIn('role', ['co_investigator', 'contributor'])
            ->update(['role' => 'researcher']);

        DB::table('project_memberships')
            ->where('role', 'observer')
            ->update(['role' => 'viewer']);

        DB::table('project_invitations')
            ->whereIn('role', ['co_investigator', 'contributor'])
            ->update(['role' => 'researcher']);

        DB::table('project_invitations')
            ->where('role', 'observer')
            ->update(['role' => 'viewer']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No reverse needed as roles are standardized to SRS canonical set
    }
};
