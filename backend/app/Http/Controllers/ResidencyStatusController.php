<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ResidencyStatusController extends Controller
{
    /**
     * Update residency status of a user.
     * Only accessible by admin users.
     */
    public function updateStatus(Request $request, $userId)
    {
        $admin = Auth::user();

        if (!$admin || $admin->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $request->validate([
            'residency_status' => 'required|in:active,deceased,relocated,for_review',
            'status_notes' => 'nullable|string|max:1000',
        ]);

        $user = User::findOrFail($userId);

        $previousStatus = $user->residency_status;

        $user->updateResidencyStatus(
            $request->input('residency_status'),
            $request->input('status_notes'),
            $admin->id
        );

        // Optionally log this action in activity logs (if ActivityLogService is available)
        if (class_exists(\App\Services\ActivityLogService::class)) {
            \App\Services\ActivityLogService::logCustom(
                'residency_status_update',
                "Residency status updated from {$previousStatus} to {$user->residency_status} by admin {$admin->name}",
                $user,
                ['previous_status' => $previousStatus, 'new_status' => $user->residency_status]
            );
        }

        return response()->json([
            'message' => 'Residency status updated successfully.',
            'user' => $user->fresh(),
        ]);
    }
}
