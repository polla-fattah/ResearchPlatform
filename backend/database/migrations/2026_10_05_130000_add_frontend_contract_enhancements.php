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
        if (!Schema::hasColumn('documents', 'draft_content')) {
            Schema::table('documents', function (Blueprint $table) {
                $table->longText('draft_content')->nullable();
                $table->unsignedInteger('draft_base_version')->nullable();
                $table->timestamp('draft_saved_at')->nullable();
                $table->foreignId('draft_author_id')->nullable()->constrained('users')->nullOnDelete();
            });
        }

        if (!Schema::hasColumn('findings', 'version')) {
            Schema::table('findings', function (Blueprint $table) {
                $table->unsignedInteger('version')->default(1);
                $table->json('contributors')->nullable();
            });
        }

        if (!Schema::hasColumn('users', 'password_reset_token')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('password_reset_token', 100)->nullable();
                $table->timestamp('password_reset_expires_at')->nullable();
                $table->timestamp('closure_requested_at')->nullable();
                $table->text('closure_reason')->nullable();
            });
        }

        if (!Schema::hasColumn('export_jobs', 'manifest')) {
            Schema::table('export_jobs', function (Blueprint $table) {
                $table->json('manifest')->nullable();
                $table->json('scope_ids')->nullable();
            });
        }

        if (!Schema::hasTable('project_resource_collections')) {
            Schema::create('project_resource_collections', function (Blueprint $table) {
                $table->id();
                $table->foreignId('project_id')->constrained('research_projects')->cascadeOnDelete();
                $table->string('name', 255);
                $table->text('description')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('project_resource_collection_items')) {
            Schema::create('project_resource_collection_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('collection_id')->constrained('project_resource_collections')->cascadeOnDelete();
                $table->foreignId('resource_id')->constrained('resources')->cascadeOnDelete();
                $table->timestamps();
                $table->unique(['collection_id', 'resource_id']);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('project_resource_collection_items');
        Schema::dropIfExists('project_resource_collections');

        if (Schema::hasColumn('export_jobs', 'manifest')) {
            Schema::table('export_jobs', function (Blueprint $table) {
                $table->dropColumn(['manifest', 'scope_ids']);
            });
        }

        if (Schema::hasColumn('users', 'password_reset_token')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn(['password_reset_token', 'password_reset_expires_at', 'closure_requested_at', 'closure_reason']);
            });
        }

        if (Schema::hasColumn('findings', 'version')) {
            Schema::table('findings', function (Blueprint $table) {
                $table->dropColumn(['version', 'contributors']);
            });
        }

        if (Schema::hasColumn('documents', 'draft_content')) {
            Schema::table('documents', function (Blueprint $table) {
                $table->dropForeign(['draft_author_id']);
                $table->dropColumn(['draft_content', 'draft_base_version', 'draft_saved_at', 'draft_author_id']);
            });
        }
    }
};
