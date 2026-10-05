<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NarratorTeacherAssessment extends Model
{
    protected $table = 'narrator_teacher_assessments';

    public $timestamps = false;

    protected $fillable = [
        'project_id',
        'narrator_id',
        'teacher_id',
        'assessment_category',
        'critic_name',
        'qawl_text',
        'created_by',
        'created_at',
    ];

    protected $casts = [
        'narrator_id' => 'integer',
        'teacher_id' => 'integer',
        'created_at' => 'datetime',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(ResearchProject::class, 'project_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
