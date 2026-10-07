<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('historical_assertions', function (Blueprint $table) {
            if (!Schema::hasColumn('historical_assertions', 'year_hijri')) {
                $table->integer('year_hijri')->nullable();
            }
            if (!Schema::hasColumn('historical_assertions', 'source')) {
                $table->string('source', 500)->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('historical_assertions', function (Blueprint $table) {
            $table->dropColumn(['year_hijri', 'source']);
        });
    }
};
