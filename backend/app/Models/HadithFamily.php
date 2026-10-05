<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class HadithFamily extends Model
{
    protected $table = 'hadith_families';

    protected $fillable = [
        'project_id',
        'canonical_title',
        'root_companion',
        'core_theme',
        'created_by',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(ResearchProject::class, 'project_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function members(): HasMany
    {
        return $this->hasMany(HadithFamilyMember::class, 'family_id');
    }
}
