<?php

namespace App\Services;

use App\Models\AuditEvent;
use Illuminate\Http\Request;

class AuditService
{
    /**
     * Log an audit event.
     */
    public static function log(
        ?int $actorId,
        string $action,
        string $objectType,
        ?int $objectId = null,
        array $details = [],
        ?string $ipAddress = null
    ): AuditEvent {
        return AuditEvent::create([
            'actor_id' => $actorId,
            'action' => $action,
            'object_type' => $objectType,
            'object_id' => $objectId,
            'details' => $details,
            'ip_address' => $ipAddress,
            'created_at' => now(),
        ]);
    }

    /**
     * Instance alias for log.
     */
    public function record(
        ?int $actorId,
        string $action,
        string $objectType,
        ?int $objectId = null,
        array $details = [],
        ?string $ipAddress = null
    ): AuditEvent {
        return self::log($actorId, $action, $objectType, $objectId, $details, $ipAddress);
    }
}
