<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('user_notification_preferences')) {
            Schema::table('user_notification_preferences', function (Blueprint $table) {
                if (!Schema::hasColumn('user_notification_preferences', 'notify_search_runs')) {
                    $table->boolean('notify_search_runs')->default(true);
                }
                if (!Schema::hasColumn('user_notification_preferences', 'notify_source_changes')) {
                    $table->boolean('notify_source_changes')->default(true);
                }
                if (!Schema::hasColumn('user_notification_preferences', 'notify_corpus_proposals')) {
                    $table->boolean('notify_corpus_proposals')->default(true);
                }
                if (!Schema::hasColumn('user_notification_preferences', 'channels')) {
                    $table->json('channels')->nullable();
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('user_notification_preferences')) {
            Schema::table('user_notification_preferences', function (Blueprint $table) {
                $table->dropColumn(['notify_search_runs', 'notify_source_changes', 'notify_corpus_proposals', 'channels']);
            });
        }
    }
};
