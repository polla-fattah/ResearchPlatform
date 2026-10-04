<?php

namespace App\Http\Controllers\Api;

use App\Models\Notification;
use App\Models\NotificationPreference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $notifications = Notification::where('user_id', $userId)
            ->orderBy('is_read', 'asc')
            ->orderBy('created_at', 'desc')
            ->limit(50)
            ->get();

        $unreadCount = Notification::where('user_id', $userId)
            ->where('is_read', false)
            ->count();

        return $this->success([
            'unread_count' => $unreadCount,
            'notifications' => $notifications,
        ]);
    }

    public function markAsRead(Request $request, int $id): JsonResponse
    {
        $notification = Notification::where('user_id', $request->user()->id)
            ->findOrFail($id);

        $notification->update([
            'is_read' => true,
            'read_at' => now(),
        ]);

        return $this->success($notification, 'Notification marked as read.');
    }

    public function markAllAsRead(Request $request): JsonResponse
    {
        Notification::where('user_id', $request->user()->id)
            ->where('is_read', false)
            ->update([
                'is_read' => true,
                'read_at' => now(),
            ]);

        return $this->success(null, 'All notifications marked as read.');
    }

    public function getPreferences(Request $request): JsonResponse
    {
        $prefs = NotificationPreference::firstOrCreate(
            ['user_id' => $request->user()->id],
            [
                'notify_invitations' => true,
                'notify_mentions' => true,
                'notify_assignments' => true,
                'notify_reviews' => true,
                'notify_exports' => true,
                'email_digest' => 'instant',
            ]
        );

        return $this->success($prefs);
    }

    public function updatePreferences(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'notify_invitations' => 'sometimes|boolean',
            'notify_mentions' => 'sometimes|boolean',
            'notify_assignments' => 'sometimes|boolean',
            'notify_reviews' => 'sometimes|boolean',
            'notify_exports' => 'sometimes|boolean',
            'email_digest' => 'sometimes|string|in:instant,daily,weekly,never',
        ]);

        $prefs = NotificationPreference::updateOrCreate(
            ['user_id' => $request->user()->id],
            $validated
        );

        return $this->success($prefs, 'Notification preferences updated.');
    }
}
