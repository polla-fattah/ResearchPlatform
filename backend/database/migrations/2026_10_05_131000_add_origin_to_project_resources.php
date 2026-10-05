<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('project_resources') && !Schema::hasColumn('project_resources', 'origin')) {
            Schema::table('project_resources', function (Blueprint $table) {
                $table->json('origin')->nullable();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('project_resources') && Schema::hasColumn('project_resources', 'origin')) {
            Schema::table('project_resources', function (Blueprint $table) {
                $table->dropColumn('origin');
            });
        }
    }
};
