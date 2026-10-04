<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NotificationPreference extends Model
{
    use HasFactory;

    protected $table = 'user_notification_preferences';

    protected $fillable = [
        'user_id',
        'notify_invitations',
        'notify_mentions',
        'notify_assignments',
        'notify_reviews',
        'notify_exports',
        'email_digest',
    ];

    protected function casts(): array
    {
        return [
            'notify_invitations' => 'boolean',
            'notify_mentions' => 'boolean',
            'notify_assignments' => 'boolean',
            'notify_reviews' => 'boolean',
            'notify_exports' => 'boolean',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
