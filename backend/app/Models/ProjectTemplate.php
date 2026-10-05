<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProjectTemplate extends Model
{
    protected $table = 'project_templates';
    public $timestamps = false;

    protected $fillable = [
        'slug',
        'title',
        'description',
        'default_question',
        'recommended_stages',
        'default_tasks',
        'created_at',
    ];

    protected $casts = [
        'recommended_stages' => 'array',
        'default_tasks' => 'array',
        'created_at' => 'datetime',
    ];
}
