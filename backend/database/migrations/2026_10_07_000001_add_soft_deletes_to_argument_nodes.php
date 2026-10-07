<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** C-39: a removed point is kept, so the history of an argument can be read. */
    public function up(): void
    {
        if (Schema::hasTable('argument_nodes') && !Schema::hasColumn('argument_nodes', 'deleted_at')) {
            Schema::table('argument_nodes', function (Blueprint $table) {
                $table->softDeletes();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('argument_nodes', 'deleted_at')) {
            Schema::table('argument_nodes', function (Blueprint $table) {
                $table->dropSoftDeletes();
            });
        }
    }
};
