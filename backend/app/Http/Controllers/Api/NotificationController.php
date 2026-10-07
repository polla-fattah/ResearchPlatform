<?php

namespace App\Http\Controllers\Api;

use App\Models\Notification;
use App\Models\NotificationPreference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends ApiController
{
    /**
     * List user notifications (API-12 / DEF-12).
     */
    public function index(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $query = Notification::where('user_id', $userId);

        if ($request->filled('type')) {
            $query->where('type', $request->query('type'));
        }

        if ($request->has('is_read')) {
            $isRead = filter_var($request->query('is_read'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($isRead !== null) {
                $query->where('is_read', $isRead);
            }
        }

        if ($request->filled('project_id')) {
            $projectId = $request->query('project_id');
            $query->where(function ($q) use ($projectId) {
                $q->where('project_id', $projectId)
                    ->orWhere(function ($sub) use ($projectId) {
                        $sub->where('target_type', 'project')
                            ->where('target_id', $projectId);
                    });
            });
        }

        $perPage = min((int)$request->input('per_page', 20), 100);
        $notifications = $query->orderBy('is_read', 'asc')
            ->orderBy('created_at', 'desc')
            ->paginate($perPage);

        $unreadCount = Notification::where('user_id', $userId)
            ->where('is_read', false)
            ->count();

        $items = collect($notifications->items())->map(function ($notif) use ($userId) {
            $data = $notif->toArray();

            // An invitation notification carries what is needed to answer it: the token of the still-pending invitation.
            if ($notif->type === 'invitation' && $notif->project_id) {
                $data['invitation_token'] = \App\Models\ProjectInvitation::where('project_id', $notif->project_id)
                    ->where('invited_user_id', $userId)
                    ->where('status', 'pending')
                    ->latest('id')
                    ->value('token');
            }

            if (!isset($data['project_id']) || $data['project_id'] === null) {
                if ($notif->target_type === 'project' && is_numeric($notif->target_id)) {
                    $data['project_id'] = (int) $notif->target_id;
                } else {
                    $data['project_id'] = null;
                }
            }
            return $data;
        })->all();

        return response()->json([
            'success' => true,
            'message' => 'Success',
            'data' => [
                'unread_count' => $unreadCount,
                'notifications' => $items,
            ],
            'meta' => [
                'timestamp' => now()->toIso8601String(),
                'version' => 'v1',
                'pagination' => [
                    'current_page' => $notifications->currentPage(),
                    'per_page' => $notifications->perPage(),
                    'total_items' => $notifications->total(),
                    'total_pages' => $notifications->lastPage(),
                    'has_more' => $notifications->hasMorePages(),
                ],
            ],
        ]);
    }

    /**
     * Get unread notifications count (API-12).
     */
    public function unreadCount(Request $request): JsonResponse
    {
        $unreadCount = Notification::where('user_id', $request->user()->id)
            ->where('is_read', false)
            ->count();

        return $this->success(['unread_count' => $unreadCount]);
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
                'notify_search_runs' => true,
                'notify_source_changes' => true,
                'notify_corpus_proposals' => true,
                'channels' => ['in_app' => true, 'email' => true],
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
            'notify_search_runs' => 'sometimes|boolean',
            'notify_source_changes' => 'sometimes|boolean',
            'notify_corpus_proposals' => 'sometimes|boolean',
            'channels' => 'sometimes|array',
            'email_digest' => 'sometimes|string|in:instant,daily,weekly,never',
        ]);

        $prefs = NotificationPreference::updateOrCreate(
            ['user_id' => $request->user()->id],
            $validated
        );

        return $this->success($prefs, 'Notification preferences updated.');
    }
}
