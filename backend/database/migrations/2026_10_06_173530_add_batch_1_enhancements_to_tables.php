<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('annotations')) {
            Schema::table('annotations', function (Blueprint $table) {
                if (!Schema::hasColumn('annotations', 'attributed_to')) {
                    $table->string('attributed_to', 255)->nullable();
                }
                if (!Schema::hasColumn('annotations', 'source_locator')) {
                    $table->string('source_locator', 255)->nullable();
                }
            });
        }

        if (Schema::hasTable('review_assignments')) {
            Schema::table('review_assignments', function (Blueprint $table) {
                if (!Schema::hasColumn('review_assignments', 'status')) {
                    $table->string('status', 50)->default('invited');
                }
                if (!Schema::hasColumn('review_assignments', 'declined_reason')) {
                    $table->text('declined_reason')->nullable();
                }
                if (!Schema::hasColumn('review_assignments', 'declined_at')) {
                    $table->timestamp('declined_at')->nullable();
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('review_assignments')) {
            Schema::table('review_assignments', function (Blueprint $table) {
                $table->dropColumn(['status', 'declined_reason', 'declined_at']);
            });
        }

        if (Schema::hasTable('annotations')) {
            Schema::table('annotations', function (Blueprint $table) {
                $table->dropColumn(['attributed_to', 'source_locator']);
            });
        }
    }
};
