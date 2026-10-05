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
        // 1. Project Milestones (API-4)
        if (!Schema::hasTable('project_milestones')) {
            Schema::create('project_milestones', function (Blueprint $table) {
                $table->id();
                $table->foreignId('project_id')->constrained('research_projects')->cascadeOnDelete();
                $table->string('title');
                $table->date('due_date')->nullable();
                $table->string('progress_mode')->default('manual'); // computed, manual
                $table->integer('manual_percent')->default(0);
                $table->string('computed_basis')->nullable();
                $table->boolean('is_completed')->default(false);
                $table->timestamps();
            });
        }

        // 2. Project Questions (API-4)
        if (!Schema::hasTable('project_questions')) {
            Schema::create('project_questions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('project_id')->constrained('research_projects')->cascadeOnDelete();
                $table->text('text');
                $table->jsonb('linked_evidence_ids')->default('[]');
                $table->boolean('resolved')->default(false);
                $table->timestamps();
            });
        }

        // 3. Support Grants (API-10)
        if (!Schema::hasTable('support_grants')) {
            Schema::create('support_grants', function (Blueprint $table) {
                $table->id();
                $table->foreignId('admin_id')->constrained('users')->cascadeOnDelete();
                $table->foreignId('granted_by')->constrained('users')->cascadeOnDelete();
                $table->string('scope'); // project, document
                $table->unsignedBigInteger('object_id');
                $table->timestamp('expires_at');
                $table->text('reason')->nullable();
                $table->string('status')->default('active'); // active, revoked, expired
                $table->timestamps();
            });
        }

        // 4. System Limits & Quotas (API-10)
        if (!Schema::hasTable('system_limits')) {
            Schema::create('system_limits', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->nullable()->constrained('users')->cascadeOnDelete();
                $table->string('key')->unique();
                $table->jsonb('value');
                $table->timestamps();
            });
        }

        // 5. Project Ownership Transfers (API-11)
        if (!Schema::hasTable('project_transfers')) {
            Schema::create('project_transfers', function (Blueprint $table) {
                $table->id();
                $table->foreignId('project_id')->constrained('research_projects')->cascadeOnDelete();
                $table->foreignId('from_user_id')->constrained('users')->cascadeOnDelete();
                $table->foreignId('to_user_id')->constrained('users')->cascadeOnDelete();
                $table->string('status')->default('pending'); // pending, accepted, declined, cancelled
                $table->timestamp('expires_at')->nullable();
                $table->timestamps();
            });
        }

        // 6. Email Verifications & Recovery (API-1)
        if (!Schema::hasTable('email_verifications')) {
            Schema::create('email_verifications', function (Blueprint $table) {
                $table->id();
                $table->string('email')->index();
                $table->string('token', 64)->unique();
                $table->timestamp('expires_at');
                $table->timestamp('used_at')->nullable();
                $table->timestamps();
            });
        }

        // 7. Application Information Requests & Replies (API-1)
        if (!Schema::hasTable('application_replies')) {
            Schema::create('application_replies', function (Blueprint $table) {
                $table->id();
                $table->foreignId('application_id')->constrained('researcher_applications')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->text('message');
                $table->string('type')->default('reply'); // request, reply, appeal
                $table->timestamps();
            });
        }

        // 8. Add extra fields to researcher_applications if missing
        Schema::table('researcher_applications', function (Blueprint $table) {
            if (!Schema::hasColumn('researcher_applications', 'reference')) {
                $table->string('reference')->nullable()->unique();
            }
            if (!Schema::hasColumn('researcher_applications', 'information_request')) {
                $table->jsonb('information_request')->nullable();
            }
        });

        // 9. Add extra fields to research_projects if missing
        Schema::table('research_projects', function (Blueprint $table) {
            if (!Schema::hasColumn('research_projects', 'tags')) {
                $table->jsonb('tags')->default('[]');
            }
            if (!Schema::hasColumn('research_projects', 'languages')) {
                $table->jsonb('languages')->default('["ar"]');
            }
        });

        // 10. Add extra fields to library_items if missing
        Schema::table('library_items', function (Blueprint $table) {
            if (!Schema::hasColumn('library_items', 'locator')) {
                $table->string('locator')->nullable();
            }
            if (!Schema::hasColumn('library_items', 'excerpt_text')) {
                $table->text('excerpt_text')->nullable();
            }
            if (!Schema::hasColumn('library_items', 'snapshot_data')) {
                $table->jsonb('snapshot_data')->nullable();
            }
            if (!Schema::hasColumn('library_items', 'snapshot_corpus_version')) {
                $table->string('snapshot_corpus_version')->nullable();
            }
            if (!Schema::hasColumn('library_items', 'source_status')) {
                $table->string('source_status')->default('current');
            }
            if (!Schema::hasColumn('library_items', 'incomplete_citation_flags')) {
                $table->jsonb('incomplete_citation_flags')->default('[]');
            }
            if (!Schema::hasColumn('library_items', 'tags')) {
                $table->jsonb('tags')->default('[]');
            }
            if (!Schema::hasColumn('library_items', 'notes')) {
                $table->jsonb('notes')->default('[]');
            }
        });

        // 11. Add extra fields to search_runs if missing
        Schema::table('search_runs', function (Blueprint $table) {
            if (!Schema::hasColumn('search_runs', 'query_version')) {
                $table->integer('query_version')->default(1);
            }
            if (!Schema::hasColumn('search_runs', 'index_id')) {
                $table->string('index_id')->nullable();
            }
            if (!Schema::hasColumn('search_runs', 'progress')) {
                $table->jsonb('progress')->nullable();
            }
            if (!Schema::hasColumn('search_runs', 'hits')) {
                $table->jsonb('hits')->nullable();
            }
        });

        // 12. Add extra fields to export_jobs if missing
        Schema::table('export_jobs', function (Blueprint $table) {
            if (!Schema::hasColumn('export_jobs', 'progress')) {
                $table->jsonb('progress')->nullable();
            }
            if (!Schema::hasColumn('export_jobs', 'parts')) {
                $table->jsonb('parts')->nullable();
            }
            if (!Schema::hasColumn('export_jobs', 'exclusions')) {
                $table->jsonb('exclusions')->nullable();
            }
            if (!Schema::hasColumn('export_jobs', 'failure_reason')) {
                $table->text('failure_reason')->nullable();
            }
        });

        // 13. Add extra fields to researcher_profiles if missing
        Schema::table('researcher_profiles', function (Blueprint $table) {
            if (!Schema::hasColumn('researcher_profiles', 'mfa_secret')) {
                $table->string('mfa_secret')->nullable();
            }
            if (!Schema::hasColumn('researcher_profiles', 'recovery_codes')) {
                $table->jsonb('recovery_codes')->nullable();
            }
            if (!Schema::hasColumn('researcher_profiles', 'display_preferences')) {
                $table->jsonb('display_preferences')->nullable();
            }
            if (!Schema::hasColumn('researcher_profiles', 'roles')) {
                $table->jsonb('roles')->nullable();
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('project_milestones');
        Schema::dropIfExists('project_questions');
        Schema::dropIfExists('support_grants');
        Schema::dropIfExists('system_limits');
        Schema::dropIfExists('project_transfers');
        Schema::dropIfExists('email_verifications');
        Schema::dropIfExists('application_replies');
    }
};
