<?php

namespace App\Http\Controllers;

use App\Models\Resident;
use App\Models\Profile;
use App\Services\ActivityLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class ResidentController extends Controller
{
    // 🧾 Store a new profile and resident
    public function store(Request $request)
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            // Profile fields
            'residents_id'       => 'required|string|unique:profiles,residents_id',
            'first_name'         => 'required|string',
            'middle_name'        => 'nullable|string',
            'last_name'          => 'required|string',
            'name_suffix'        => 'nullable|string',
            'birth_date'         => 'required|date',
            'birth_place'        => 'required|string',
            'age'                => 'required|integer',
            'nationality'        => 'nullable|string',
            'email'              => 'required|email',
            'mobile_number'     => 'required|string',
            'sex'                => 'required|string',
            'civil_status'       => 'required|string',
            'religion'           => 'required|string',
            'current_address'       => 'required|string',
            'years_in_barangay'  => 'required|integer',
            'voter_status'       => 'required|string',
            'avatar'             => 'nullable|image|mimes:jpg,jpeg,png|max:2048',

            // Resident fields
            'household_no'       => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $data = $validator->validated();

        if (Profile::where('user_id', $user->id)->exists()) {
            return response()->json(['message' => 'Profile already exists.'], 409);
        }

        // ✅ Correct avatar upload logic
        if ($request->hasFile('avatar')) {
            $data['avatar'] = $request->file('avatar')->store('avatars', 'public');
        }

        $profile = Profile::create([
            ...$data,
            'user_id' => $user->id,
            'avatar'  => $data['avatar'] ?? null,
        ]);

        $resident = Resident::create([
            ...$data,
            'user_id'    => $user->id,
            'profile_id' => $profile->id,
            'residents_id' => $profile->residents_id,
            'avatar'     => $data['avatar'] ?? null,
        ]);

        // Log resident creation
        ActivityLogService::logCreated($resident, $request);
        ActivityLogService::logCreated($profile, $request);

        return response()->json([
            'message'  => '✅ Profile and Resident successfully saved.',
            'profile'  => $profile,
            'resident' => $resident,
        ], 201);
    }

    // 📄 Get all residents with profiles
    public function index()
    {
        $residents = Resident::with('profile')->get();

        $now = \Carbon\Carbon::now();
        $residents = $residents->map(function ($resident) use ($now) {
            $lastUpdated = $resident->updated_at;
            $months = $lastUpdated ? $now->diffInMonths($lastUpdated) : null;
            if ($months === null) {
                $updateStatus = 'Needs Verification';
            } elseif ($months < 6) {
                $updateStatus = 'Active';
            } elseif ($months < 12) {
                $updateStatus = 'Outdated';
            } else {
                $updateStatus = 'Needs Verification';
            }
            $resident->update_status = $updateStatus;
            $resident->for_review = $months !== null && $months >= 12;
            return $resident;
        });

        return response()->json([
            'residents' => $residents
        ]);
    }

    // 👤 Get current user's resident profile
    public function myProfile(Request $request)
    {
        $user = $request->user();
        
        $resident = Resident::where('user_id', $user->id)->first();
        
        if (!$resident) {
            return response()->json([
                'message' => 'Resident profile not found. Please complete your profile first.'
            ], 404);
        }
        
        return response()->json($resident);
    }

    // ✏️ Update existing resident and profile
    public function update(Request $request, $id)
    {
        $resident = Resident::findOrFail($id);
        $profile = $resident->profile;

        $validator = Validator::make($request->all(), [
            'first_name'         => 'required|string',
            'middle_name'        => 'nullable|string',
            'last_name'          => 'required|string',
            'name_suffix'        => 'nullable|string',
            'birth_date'         => 'required|date',
            'birth_place'        => 'required|string',
            'age'                => 'required|integer',
            'nationality'        => 'nullable|string',
            'email'              => 'required|email',
            'mobile_number'     => 'required|string',
            'sex'                => 'required|string',
            'civil_status'       => 'required|string',
            'religion'           => 'required|string',
            'current_address'       => 'required|string',
            'years_in_barangay'  => 'required|integer',
            'voter_status'       => 'required|string',
            'household_no'       => 'required|string',
            'avatar'             => 'nullable|image|mimes:jpg,jpeg,png|max:2048',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $data = $validator->validated();

        // ✅ Correct avatar upload logic
        if ($request->hasFile('avatar')) {
            // Optionally delete the old avatar file
            if ($profile->avatar) {
                Storage::disk('public')->delete($profile->avatar);
            }
            $data['avatar'] = $request->file('avatar')->store('avatars', 'public');
            $profile->avatar = $data['avatar'];
            $resident->avatar = $data['avatar'];
        }

        // Fill and save other data
        $profile->fill($data)->save();
        $resident->fill($data);
        $resident->last_modified = now(); // Set last modified timestamp
        $resident->save();

        // Log resident update
        ActivityLogService::logUpdated($resident, $resident->getOriginal(), $request);
        ActivityLogService::logUpdated($profile, $profile->getOriginal(), $request);

        // Check if resident should be flagged for review
        $this->checkAndFlagForReview($resident);

        return response()->json([
            'message'  => '✅ Resident and profile updated successfully.',
            'resident' => $resident,
            'profile'  => $profile,
        ]);
    }

    // 📊 Get residents with filtering and sorting for reporting
    public function report(Request $request)
    {
        \Log::info('Report endpoint called', ['request' => $request->all()]);
        \Log::info('Authenticated user:', ['user' => $request->user() ? $request->user()->id : null]);
        
        // Log all residents in database for debugging
        $allResidents = Resident::all();
        \Log::info('All residents in database', [
            'count' => $allResidents->count(),
            'residents' => $allResidents->pluck('id', 'last_modified')
        ]);
        
        $query = Resident::with('profile', 'user');

        // Filter by update status
        if ($request->has('update_status')) {
            $status = $request->input('update_status');
            $now = now();
            
            switch ($status) {
                case 'active':
                    $query->where('last_modified', '>=', $now->copy()->subMonths(6));
                    break;
                case 'outdated':
                    $query->whereBetween('last_modified', [
                        $now->copy()->subMonths(12),
                        $now->copy()->subMonths(6)
                    ]);
                    break;
                case 'needs_verification':
                    $query->where(function($q) use ($now) {
                        $q->whereNull('last_modified')
                         ->orWhere('last_modified', '<', $now->copy()->subMonths(12));
                    });
                    break;
                case 'for_review':
                    $query->where('for_review', true);
                    break;
            }
        }

        // Filter by verification status
        if ($request->has('verification_status')) {
            $query->where('verification_status', $request->input('verification_status'));
        }

        // Sort options
        $sortBy = $request->input('sort_by', 'last_modified');
        $sortOrder = $request->input('sort_order', 'desc');
        
        $validSortFields = ['last_modified', 'created_at', 'first_name', 'last_name', 'verification_status'];
        if (in_array($sortBy, $validSortFields)) {
            $query->orderBy($sortBy, $sortOrder);
        }

        $residents = $query->get();
        
        // Calculate update status for each resident (same logic as index method)
        $now = now();
        $residents = $residents->map(function ($resident) use ($now) {
            $lastUpdated = $resident->last_modified;
            $months = $lastUpdated ? $now->diffInMonths($lastUpdated) : null;
            if ($months === null) {
                $updateStatus = 'Needs Verification';
            } elseif ($months < 6) {
                $updateStatus = 'Active';
            } elseif ($months < 12) {
                $updateStatus = 'Outdated';
            } else {
                $updateStatus = 'Needs Verification';
            }
            $resident->update_status = $updateStatus;
            $resident->for_review = $months !== null && $months >= 12;
            return $resident;
        });
        
        \Log::info('Filtered residents', [
            'count' => $residents->count(),
            'residents' => $residents->pluck('id')
        ]);

        // Check if any residents were found
        if ($residents->isEmpty()) {
            \Log::warning('No residents found in report query');
            return response()->json([
                'message' => 'No residents found matching the criteria',
                'residents' => [],
                'filters' => $request->all(),
                'total_count' => Resident::count()
            ], 200);
        }

        return response()->json([
            'residents' => $residents,
            'filters' => $request->all(),
            'total_count' => Resident::count()
        ]);
    }

    // 🔄 Check and flag resident for review based on activity
    private function checkAndFlagForReview(Resident $resident)
    {
        $now = now();
        $lastModified = $resident->last_modified;
        $lastLogin = $resident->user->has_logged_in ? $resident->user->updated_at : null;

        // If no activity in the last year, flag for review
        $lastActivity = max($lastModified, $lastLogin);
        
        if (!$lastActivity || $lastActivity->diffInMonths($now) >= 12) {
            $resident->for_review = true;
        } else {
            $resident->for_review = false;
        }
        
        $resident->save();
    }

    // 🔄 Batch update to check all residents for review status
    public function batchCheckReviewStatus()
    {
        $residents = Resident::with('user')->get();
        $updatedCount = 0;

        foreach ($residents as $resident) {
            $originalStatus = $resident->for_review;
            $this->checkAndFlagForReview($resident);
            
            if ($resident->for_review !== $originalStatus) {
                $updatedCount++;
            }
        }

        return response()->json([
            'message' => "Review status checked for {$residents->count()} residents. {$updatedCount} records updated."
        ]);
    }
}
