<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use App\Models\Profile;
use App\Models\Resident;
use App\Notifications\ProfileUpdatedNotification;
use App\Mail\ResidencyVerificationDeniedMail;
use App\Notifications\ResidencyVerificationApproved;

class ResidentProfileController extends Controller
{
    // 🔍 Admin: List all residents with profiles
    public function index(Request $request)
    {
        try {
            $user = $request->user();
            $residents = Resident::with('profile', 'user')->get();
            \Log::info('ResidentProfileController@index debug', [
                'requested_by' => $user ? $user->id : null,
                'requested_by_role' => $user ? $user->role : null,
                'residents_count' => $residents->count(),
                'first_resident' => $residents->first(),
            ]);
            return response()->json([
                'residents' => $residents,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Resident index fetch failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'message' => 'Failed to fetch residents.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    // 👤 Authenticated user: View own profile
    public function show(Request $request)
    {
        try {
            $user = $request->user();
            
            if (!$user) {
                \Log::error('Profile show: No authenticated user found');
                return response()->json([
                    'message' => 'Authentication required',
                    'error' => 'NO_AUTH'
                ], 401);
            }
            
            \Log::info('Profile show request', [
                'user_id' => $user->id,
                'user_email' => $user->email,
                'user_role' => $user->role
            ]);
            
            // Check if user is admin and has admin profile
            if ($user->role === 'admin') {
                $adminProfile = \App\Models\AdminProfile::where('user_id', $user->id)->first();
                if ($adminProfile) {
                    \Log::info('Profile show: Admin user with admin profile found', [
                        'user_id' => $user->id,
                        'admin_profile_id' => $adminProfile->id
                    ]);
                    $profileData = $adminProfile->toArray();
                    $userWithProfile = $user->toArray();
                    $userWithProfile['profile'] = $profileData;
                    return response()->json([
                        'user' => $userWithProfile,
                        'profile' => $profileData,
                        'is_admin' => true,
                    ], 200);
                }
            }
            
            $resident = \App\Models\Resident::where('user_id', $user->id)
                ->with('profile')
                ->orderByRaw("CASE WHEN verification_status = 'approved' THEN 0 ELSE 1 END")
                ->orderByDesc('updated_at')
                ->first();
            
            if (!$resident) {
                // Fallback: return Profile model data if Resident doesn't exist yet
                $profile = Profile::where('user_id', $user->id)->first();
                if ($profile) {
                    \Log::info('Profile show: Resident missing, returning profile-only data', [
                        'user_id' => $user->id,
                        'profile_id' => $profile->id,
                        'verification_status' => $profile->verification_status,
                    ]);
                    $profileData = $profile->toArray();
                    // Map avatar field from current_photo if needed
                    if (!isset($profileData['avatar']) && isset($profileData['current_photo'])) {
                        $profileData['avatar'] = $profileData['current_photo'];
                    }
                    $userWithProfile = $user->toArray();
                    $userWithProfile['profile'] = $profileData;
                    return response()->json([
                        'user' => $userWithProfile,
                        'profile' => $profileData,
                        'resident_exists' => false,
                    ], 200);
                }
                \Log::info('Profile show: No resident or profile found for user', [
                    'user_id' => $user->id
                ]);
                return response()->json([
                    'message' => 'No profile found',
                    'user' => $user,
                    'profile' => null,
                    'error_code' => 'NO_RESIDENT_PROFILE'
                ], 404);
            }
            
            // Return the resident data as the main profile data
            $profileData = $resident->toArray();
            
            // Store the resident's ID before merging with profile data
            $residentId = $resident->id;
            
            // If there's a separate profile record, merge any additional data
            if ($resident->profile) {
                $profileData = array_merge($profileData, $resident->profile->toArray());
            }
            
            // Ensure the resident ID is correctly set (not overwritten by profile ID)
            $profileData['id'] = $residentId;
            // Keep the public resident_id string stable for frontend usage
            $profileData['resident_id'] = $resident->resident_id;
            
            // Ensure avatar field is properly mapped for frontend
            if (!isset($profileData['avatar']) && isset($profileData['current_photo'])) {
                $profileData['avatar'] = $profileData['current_photo'];
            }
            
            // Ensure verification_status prefers resident-level status when available
            $profileData['verification_status'] = $resident->verification_status
                ?? ($resident->profile ? $resident->profile->verification_status : ($profileData['verification_status'] ?? null));

            // Normalize permissions and flags so frontend has consistent shape
            if (!array_key_exists('permissions', $profileData)) {
                $profileData['permissions'] = $resident->profile && isset($resident->profile->permissions) ? $resident->profile->permissions : [];
            }
            if (!array_key_exists('my_benefits_enabled', $profileData)) {
                $profileData['my_benefits_enabled'] = $resident->profile && isset($resident->profile->my_benefits_enabled) ? (bool)$resident->profile->my_benefits_enabled : false;
            }

            \Log::info('Verification status resolution', [
                'user_id' => $user->id,
                'resident_verification_status' => $resident->verification_status ?? null,
                'profile_verification_status' => $resident->profile ? $resident->profile->verification_status : null,
                'final_verification_status' => $profileData['verification_status'] ?? null,
            ]);
            
            // DEBUG: Log the response structure
            \Log::info('Profile show response structure', [
                'user_id' => $user->id,
                'user_has_profile_relation' => $user->profile ? true : false,
                'resident_exists' => $resident ? true : false,
                'resident_has_profile' => $resident && $resident->profile ? true : false,
                'profile_data_keys' => array_keys($profileData),
                'avatar_value' => $profileData['avatar'] ?? 'not_set',
                'response_structure' => [
                    'user' => array_keys($user->toArray()),
                    'profile' => array_keys($profileData)
                ]
            ]);
            
            // FIX: Ensure user object includes profile data for frontend compatibility
            $userWithProfile = $user->toArray();
            $userWithProfile['profile'] = $profileData;
            
            return response()->json([
                'user' => $userWithProfile,
                'profile' => $profileData,
            ]);
        } catch (\Exception $e) {
            \Log::error('Profile show failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'message' => 'Error fetching profile',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    // 🧾 Admin: View single resident by ID
    public function showById($id)
    {
        try {
            $resident = Resident::with('profile', 'user')->find($id);

            if (!$resident) {
                return response()->json(['message' => 'Resident not found.'], 404);
            }

            return response()->json(['resident' => $resident], 200);
        } catch (\Exception $e) {
            Log::error('Failed to fetch resident by ID', [
                'id' => $id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'Error fetching resident.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    // 🆕 Create new resident profile
    public function store(Request $request)
    {
        try {
            // ✅ Use authenticated user or admin-supplied user_id
            $userId = $request->input('user_id') ?? Auth::id();

            if (!$userId) {
                return response()->json(['message' => 'User ID is required.'], 400);
            }

            // ❌ Check for existing profiles - redirect to update if profile exists
            $existingResident = Resident::where('user_id', $userId)->first();
            $existingProfile = \App\Models\Profile::where('user_id', $userId)->first();
            
            if ($existingProfile) {
                \Log::info('Profile already exists, updating instead of creating', [
                    'user_id' => $userId,
                    'resident_id' => $existingResident ? $existingResident->id : null,
                    'profile_id' => $existingProfile->id
                ]);
                
                // If profile exists, update it instead
                if ($existingResident) {
                    return $this->updateExistingProfile($request, $existingResident);
                } else {
                    // Create resident and link to existing profile
                    $request->merge(['existing_profile_id' => $existingProfile->id]);
                    // Continue with store method but link to existing profile
                }
            }
            
            // Clean up any duplicate residents for this user before creating new profile
            if ($existingResident) {
                $duplicateResidents = Resident::where('user_id', $userId)
                    ->where('id', '!=', $existingResident->id)
                    ->get();
                
                if ($duplicateResidents->count() > 0) {
                    \Log::info('Cleaning up duplicate residents before creating profile', [
                        'user_id' => $userId,
                        'keeping_resident_id' => $existingResident->id,
                        'deleting_count' => $duplicateResidents->count()
                    ]);
                    
                    foreach ($duplicateResidents as $duplicate) {
                        if ($duplicate->profile) {
                            $duplicate->profile->delete();
                        }
                        $duplicate->delete();
                    }
                }
            }

            // More flexible validation - make most fields nullable for updates
            $validated = $request->validate([
                'first_name' => 'nullable|string',
                'last_name' => 'nullable|string',
                'birth_date' => 'nullable|date',
                'birth_place' => 'nullable|string',
                'age' => 'nullable|integer',
                'email' => 'nullable|email',
                'mobile_number' => 'nullable|string',
                'sex' => 'nullable|string',
                'civil_status' => 'nullable|string',
                'religion' => 'nullable|string',
                'current_address' => 'nullable|string',
                'years_in_barangay' => 'nullable|integer',
                'voter_status' => 'nullable|string',
                'head_of_family' => 'nullable|boolean',
                'current_photo' => 'nullable|image|mimes:jpeg,png,jpg,gif,svg|max:2048',
                'residency_verification_image' => 'nullable|string',

                // Optional
                'middle_name' => 'nullable|string',
                'name_suffix' => 'nullable|string',
                'nationality' => 'nullable|string',
                'relation_to_head' => 'nullable|string',
                'voters_id_number' => 'nullable|string',
                'voting_location' => 'nullable|string',
                'housing_type' => 'nullable|string',
                'household_no' => 'nullable|string',
                'classified_sector' => 'nullable|string',
                'educational_attainment' => 'nullable|string',
                'occupation_type' => 'nullable|string',
                'salary_income' => 'nullable|string',
                'business_info' => 'nullable|string',
                'business_type' => 'nullable|string',
                'business_location' => 'nullable|string',
                'business_outside_barangay' => 'nullable|boolean',
                'special_categories' => 'nullable|array',
                'covid_vaccine_status' => 'nullable|string',
                'vaccine_received' => 'nullable|array',
                'other_vaccine' => 'nullable|string',
                'year_vaccinated' => 'nullable|integer',
            ]);

            // Get all fillable data and provide safe defaults for required fields
            $fillable = (new Profile)->getFillable();
            $data = [];
            foreach ($fillable as $field) {
                // Use request input with safe default for each field
                switch ($field) {
                    case 'contact_number':
                        $data[$field] = $request->input($field, 'Not provided');
                        break;
                    case 'first_name':
                        $data[$field] = $request->input($field, 'Unknown');
                        break;
                    case 'last_name':
                        $data[$field] = $request->input($field, 'Unknown');
                        break;
                    case 'email':
                        $data[$field] = $request->input($field, 'noemail@example.com');
                        break;
                    case 'birth_date':
                        $data[$field] = $request->input($field, now()->subYears(18)->format('Y-m-d'));
                        break;
                    case 'birth_place':
                        $data[$field] = $request->input($field, 'Unknown');
                        break;
                    case 'age':
                        $data[$field] = $request->input($field, 18);
                        break;
                    case 'sex':
                        $data[$field] = $request->input($field, 'Not specified');
                        break;
                    case 'civil_status':
                        $data[$field] = $request->input($field, 'Single');
                        break;
                    case 'religion':
                        $data[$field] = $request->input($field, 'Not specified');
                        break;
                    case 'years_in_barangay':
                        $data[$field] = $request->input($field, 0);
                        break;
                    case 'voter_status':
                        $data[$field] = $request->input($field, 'Not registered');
                        break;
                    case 'head_of_family':
                        $data[$field] = $request->boolean($field);
                        break;
                    case 'business_outside_barangay':
                        $data[$field] = $request->boolean($field);
                        break;
                    case 'special_categories':
                        $data[$field] = $request->input($field, []);
                        break;
                    case 'vaccine_received':
                        $data[$field] = $request->input($field, []);
                        break;
                    default:
                        $data[$field] = $request->input($field, null);
                }
            }
            // Handle residency verification image upload
            if ($request->hasFile('residency_verification_image')) {
                $data['residency_verification_image'] = $request->file('residency_verification_image')->store('residency_verification_images', 'public');
            }
            // Remove avatar upload, use current_photo
            if ($request->hasFile('current_photo')) {
                $data['current_photo'] = $request->file('current_photo')->store('avatars', 'public');
            }

            // Check if we should use existing profile
            $existingProfileId = $request->input('existing_profile_id');
            if ($existingProfileId) {
                $profile = \App\Models\Profile::find($existingProfileId);
                if ($profile) {
                    $profile->update($data);
                    \Log::info('Updated existing profile instead of creating new one', [
                        'profile_id' => $profile->id,
                        'user_id' => $userId
                    ]);
                } else {
                    // Only generate $residentsId and set resident_id when creating a new profile
                    $residentsId = 'RES-' . now()->format('YmdHis') . '-' . strtoupper(substr($validated['last_name'], 0, 3));
                    $data['resident_id'] = $residentsId;
                    $profile = new Profile($data);
                    $profile->user_id = $userId;
                    $profile->save();
                }
            } else {
                $residentsId = 'RES-' . now()->format('YmdHis') . '-' . strtoupper(substr($validated['last_name'], 0, 3));
                $data['resident_id'] = $residentsId;
                $profile = new Profile($data);
                $profile->user_id = $userId;
                $profile->save();
            }

            // Set profile_completed if all required fields are filled and verification_status is approved
            $requiredFields = ['first_name','last_name','birth_date','sex','civil_status','religion','current_address','years_in_barangay','voter_status','housing_type','classified_sector','educational_attainment','occupation_type','salary_income'];
            $isComplete = true;
            $missingFields = [];
            foreach ($requiredFields as $field) {
                if (empty($profile->$field)) {
                    $isComplete = false;
                    $missingFields[] = $field;
                }
            }
            if (!$isComplete) {
                \Log::warning('Profile NOT completed for user_id ' . $userId . '. Missing fields:', [
                    'missing_fields' => $missingFields,
                    'profile_id' => $profile->id,
                    'profile_data' => $profile->toArray()
                ]);
            } else {
                \Log::info('Profile completed for user_id ' . $userId . '. All required fields present.');
            }
            if ($profile->verification_status === 'approved' && $isComplete) {
                $profile->profile_completed = true;
                $profile->save();
            } else {
                $profile->profile_completed = false;
                $profile->save();
            }

            // After saving profile, update resident with all profile fields except residents_id
            $residentData = $profile->toArray();
            unset($residentData['resident_id']);
            // Ensure mobile_number is set in resident (no mapping needed if field matches)
            $resident = Resident::where('user_id', $userId)->first();
            if ($resident) {
                $resident->fill($residentData);
                $resident->profile_id = $profile->id;
                $resident->save();
            } else {
                $resident = new Resident($residentData);
                $resident->user_id = $userId;
                $resident->profile_id = $profile->id;
                // Set resident_id to match profile's resident_id
                $resident->resident_id = $profile->resident_id;
                $resident->save();
            }

            $user = Auth::user();
            // Temporarily disable notification to prevent email configuration errors
            // $user->notify(new ProfileUpdatedNotification($profile, $resident));

            return response()->json([
                'message' => 'Profile and Resident created successfully.',
                'resident_id' => $profile->resident_id ?? ($resident->resident_id ?? null),
                'profile' => $profile,
                'resident' => $resident,
            ], 201);
        } catch (\Exception $e) {
            Log::error('Profile store failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'message' => 'Failed to create profile',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    // ✏️ Update existing profile
    public function update(Request $request)
    {
        try {
            $user = $request->user();
            
            \Log::info('Profile update attempt', [
                'user_id' => $user->id,
                'user_email' => $user->email,
                'has_current_photo_file' => $request->hasFile('current_photo')
            ]);
            
            // Try to find existing resident - use first() to get the first one if duplicates exist
            $resident = \App\Models\Resident::where('user_id', $user->id)->first();
            
            // If no resident exists, create both resident and profile
            if (!$resident) {
                \Log::info('No resident found, creating new profile via store method');
                return $this->store($request);
            }
            
            // Clean up any duplicate residents for this user (keep the first one)
            $duplicateResidents = \App\Models\Resident::where('user_id', $user->id)
                ->where('id', '!=', $resident->id)
                ->get();
            
            if ($duplicateResidents->count() > 0) {
                \Log::info('Found duplicate residents, cleaning up', [
                    'user_id' => $user->id,
                    'keeping_resident_id' => $resident->id,
                    'deleting_count' => $duplicateResidents->count()
                ]);
                
                foreach ($duplicateResidents as $duplicate) {
                    // Delete associated profiles if they exist
                    if ($duplicate->profile) {
                        $duplicate->profile->delete();
                    }
                    $duplicate->delete();
                }
            }
            
            // Check for existing profile both through resident relationship and directly by user_id
            $profile = $resident->profile;
            if (!$profile) {
                // Also check if there's a profile directly by user_id
                $profile = \App\Models\Profile::where('user_id', $user->id)->first();
            }

            // If resident exists but no profile, create profile and link it
            if (!$profile) {
                \Log::info('Resident exists but no profile, creating profile and linking');
                return $this->store($request);
            } else if (!$resident->profile_id && $profile) {
                // If profile exists but not linked to resident, link them
                \Log::info('Profile exists but not linked to resident, linking them', [
                    'resident_id' => $resident->id,
                    'profile_id' => $profile->id
                ]);
                $resident->profile_id = $profile->id;
                $resident->save();
            }
            
            \Log::info('Updating existing profile', [
                'resident_id' => $resident->id,
                'profile_id' => $profile->id
            ]);

            // Flexible validation for updates - all fields nullable
            $validated = $request->validate([
                'first_name' => 'nullable|string',
                'last_name' => 'nullable|string',
                'birth_date' => 'nullable|date',
                'birth_place' => 'nullable|string',
                'age' => 'nullable|integer',
                'email' => 'nullable|email',
                'contact_number' => 'nullable|string',
                'sex' => 'nullable|string',
                'civil_status' => 'nullable|string',
                'religion' => 'nullable|string',
                'current_address' => 'nullable|string',
                'years_in_barangay' => 'nullable|integer',
                'voter_status' => 'nullable|string',
                'head_of_family' => 'nullable|boolean',
                'current_photo' => 'nullable|image|mimes:jpeg,png,jpg,gif,svg|max:2048',
                'residency_verification_image' => 'nullable|string',

                // Optional
                'middle_name' => 'nullable|string',
                'name_suffix' => 'nullable|string',
                'nationality' => 'nullable|string',
                'relation_to_head' => 'nullable|string',
                'voters_id_number' => 'nullable|string',
                'voting_location' => 'nullable|string',
                'housing_type' => 'nullable|string',
                'household_no' => 'nullable|string',
                'classified_sector' => 'nullable|string',
                'educational_attainment' => 'nullable|string',
                'occupation_type' => 'nullable|string',
                'salary_income' => 'nullable|string',
                'business_info' => 'nullable|string',
                'business_type' => 'nullable|string',
                'business_location' => 'nullable|string',
                'business_outside_barangay' => 'nullable|boolean',
                'special_categories' => 'nullable|array',
                'covid_vaccine_status' => 'nullable|string',
                'vaccine_received' => 'nullable|array',
                'other_vaccine' => 'nullable|string',
                'year_vaccinated' => 'nullable|integer',
            ]);

            // Get all fillable data - for updates, only update provided fields safely
            $fillable = (new Profile)->getFillable();
            $data = [];
            foreach ($fillable as $field) {
                if ($request->has($field)) {
                    switch ($field) {
                        case 'head_of_family':
                        case 'business_outside_barangay':
                            $data[$field] = $request->boolean($field);
                            break;
                        case 'special_categories':
                        case 'vaccine_received':
                            $data[$field] = $request->input($field, []);
                            break;
                        default:
                            $data[$field] = $request->input($field);
                    }
                }
            }
            // Handle residency verification image upload
            if ($request->hasFile('residency_verification_image')) {
                $data['residency_verification_image'] = $request->file('residency_verification_image')->store('residency_verification_images', 'public');
            }
            // Remove avatar upload, use current_photo
            if ($request->hasFile('current_photo')) {
                $photoPath = $request->file('current_photo')->store('avatars', 'public');
                $data['current_photo'] = $photoPath;
            }
            $profile->update($data);

            // Set profile_completed if all required fields are filled and verification_status is approved
            $requiredFields = ['first_name','last_name','birth_date','sex','civil_status','religion','current_address','years_in_barangay','voter_status','housing_type','classified_sector','educational_attainment','occupation_type','salary_income'];
            $isComplete = true;
            $missingFields = [];
            foreach ($requiredFields as $field) {
                if (empty($profile->$field)) {
                    $isComplete = false;
                    $missingFields[] = $field;
                }
            }
            if (!$isComplete) {
                \Log::warning('Profile NOT completed for user_id ' . $user->id . '. Missing fields:', [
                    'missing_fields' => $missingFields,
                    'profile_id' => $profile->id,
                    'profile_data' => $profile->toArray()
                ]);
            } else {
                \Log::info('Profile completed for user_id ' . $user->id . '. All required fields present.');
            }
            if ($profile->verification_status === 'approved' && $isComplete) {
                $profile->profile_completed = true;
                $profile->save();
            } else {
                $profile->profile_completed = false;
                $profile->save();
            }

            // Remove residents_id from resident creation/update
            $residentData = $data;
            unset($residentData['resident_id']);
            // Only use mobile_number, do not map to contact_number
            $resident->fill($residentData);
            $resident->user_id = $user->id;
            $resident->profile_id = $profile->id;
            $resident->save();

            // Temporarily disable notification to prevent email configuration errors
            // $user->notify(new \App\Notifications\ProfileUpdatedNotification($profile, $resident));

            return response()->json([
                'message' => 'Profile and Resident updated successfully.',
                'profile' => $profile->fresh(),
                'resident' => $resident,
                'user' => $user->fresh('profile'),
            ]);
        } catch (\Exception $e) {
            \Log::error('Profile update failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'message' => 'An error occurred',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Helper method to update existing profile (called from store when profile exists)
     */

    private function updateExistingProfile(Request $request, $resident)
    {
        try {
            $user = $request->user();
            $profile = $resident->profile;

            // Flexible validation for updates - all fields nullable
            $validated = $request->validate([
                'first_name' => 'nullable|string',
                'last_name' => 'nullable|string',
                'birth_date' => 'nullable|date',
                'birth_place' => 'nullable|string',
                'age' => 'nullable|integer',
                'email' => 'nullable|email',
                'contact_number' => 'nullable|string',
                'sex' => 'nullable|string',
                'civil_status' => 'nullable|string',
                'religion' => 'nullable|string',
                'current_address' => 'nullable|string',
                'years_in_barangay' => 'nullable|integer',
                'voter_status' => 'nullable|string',
                'head_of_family' => 'nullable|boolean',
                'current_photo' => 'nullable|image|mimes:jpeg,png,jpg,gif,svg|max:2048',
                'residency_verification_image' => 'nullable|string',

                // Optional fields
                'middle_name' => 'nullable|string',
                'name_suffix' => 'nullable|string',
                'nationality' => 'nullable|string',
                'relation_to_head' => 'nullable|string',
                'voters_id_number' => 'nullable|string',
                'voting_location' => 'nullable|string',
                'housing_type' => 'nullable|string',
                'household_no' => 'nullable|string',
                'classified_sector' => 'nullable|string',
                'educational_attainment' => 'nullable|string',
                'occupation_type' => 'nullable|string',
                'salary_income' => 'nullable|string',
                'business_info' => 'nullable|string',
                'business_type' => 'nullable|string',
                'business_location' => 'nullable|string',
                'business_outside_barangay' => 'nullable|boolean',
                'special_categories' => 'nullable|array',
                'covid_vaccine_status' => 'nullable|string',
                'vaccine_received' => 'nullable|array',
                'other_vaccine' => 'nullable|string',
                'year_vaccinated' => 'nullable|integer',
            ]);

            // Get all fillable data - for updates, only update provided fields
            $data = array_filter($request->only((new Profile)->getFillable()), function($value) {
                return $value !== null && $value !== '';
            });
            
            // Handle residency verification image upload
            if ($request->hasFile('residency_verification_image')) {
                $data['residency_verification_image'] = $request->file('residency_verification_image')->store('residency_verification_images', 'public');
            }
            
            // Handle boolean fields explicitly
            if ($request->has('head_of_family')) {
                $data['head_of_family'] = $request->boolean('head_of_family');
            }
            if ($request->has('business_outside_barangay')) {
                $data['business_outside_barangay'] = $request->boolean('business_outside_barangay');
            }
            
            // Handle array fields
            $data['special_categories'] = $request->input('special_categories', []);
            $data['vaccine_received'] = $request->input('vaccine_received', []);

            // Remove avatar upload, use current_photo
            if ($request->hasFile('current_photo')) {
                $photoPath = $request->file('current_photo')->store('avatars', 'public');
                $data['current_photo'] = $photoPath;
            }

            $profile->update($data);

            // Remove residents_id from resident creation/update
            $residentData = $data;
            unset($residentData['resident_id']);
            // Map mobile_number from profile to contact_number in resident
            if (isset($residentData['mobile_number'])) {
                $residentData['contact_number'] = $residentData['mobile_number'];
            }
            $resident->fill($residentData);
            $resident->user_id = $user->id;
            $resident->profile_id = $profile->id;
            $resident->save();

            // Temporarily disable notification to prevent email configuration errors
            // $user->notify(new \App\Notifications\ProfileUpdatedNotification($profile, $resident));

            return response()->json([
                'message' => 'Profile updated successfully.',
                'profile' => $profile->fresh(),
                'resident' => $resident->fresh(),
                'user' => $user->fresh(),
            ]);
        } catch (\Exception $e) {
            \Log::error('updateExistingProfile failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'message' => 'An error occurred while updating profile',
                'error' => $e->getMessage()
            ], 500);
        }
    }
    
    // ✅ Approve residency verification
    public function approveVerification($id)
    {
        try {
            \DB::beginTransaction();
            
            // First try to find by profile ID
            $profile = Profile::find($id);
            $resident = null;
            
            if ($profile) {
                // Update profile verification status
                $profile->verification_status = 'approved';
                $profile->denial_reason = null;
                $profile->save();
                
                // Find resident record
                $resident = Resident::where('profile_id', $profile->id)
                    ->orWhere('id', $id)
                    ->first();
                
                // If resident doesn't exist, create one
                if (!$resident) {
                    $resident = new Resident();
                    $resident->user_id = $profile->user_id;
                    $resident->profile_id = $profile->id;
                    $resident->resident_id = $profile->resident_id;
                }
                
                // Update resident verification status
                $resident->verification_status = 'approved';
                $resident->save();
                
                // Force refresh relations
                $profile = $profile->fresh();
                $resident = $resident->fresh();
                
                // Notify the user
                if ($profile->user) {
                    $profile->user->notify(new ResidencyVerificationApproved($profile->user));
                }
                
                \DB::commit();
                
                return response()->json([
                    'success' => true,
                    'message' => 'Residency verification approved successfully.',
                    'profile' => $profile,
                    'resident' => $resident
                ], 200);
            }
            
            // If no profile found, try to find resident directly
            $resident = Resident::with('profile')->find($id);
            if ($resident) {
                \DB::beginTransaction();
                try {
                    // Update resident
                    $resident->verification_status = 'approved';
                    $resident->save();
                    
                    // Update or create profile
                    if ($resident->profile) {
                        $resident->profile->verification_status = 'approved';
                        $resident->profile->denial_reason = null;
                        $resident->profile->save();
                    } else if ($resident->user_id) {
                        $profile = new Profile();
                        $profile->user_id = $resident->user_id;
                        $profile->verification_status = 'approved';
                        $profile->resident_id = $resident->resident_id;
                        $profile->save();
                        
                        $resident->profile_id = $profile->id;
                        $resident->save();
                    }
                    
                    // Force refresh the resident with profile relation
                    $resident = $resident->fresh('profile');
                    
                    // Notify the user
                    if ($resident->user) {
                        $resident->user->notify(new ResidencyVerificationApproved($resident->user));
                    }
                    
                    \DB::commit();
                    
                    return response()->json([
                        'success' => true,
                        'message' => 'Residency verification approved successfully.',
                        'resident' => $resident,
                        'profile' => $resident->profile
                    ], 200);
                } catch (\Exception $e) {
                    \DB::rollBack();
                    throw $e;
                }
            }
            
            return response()->json([
                'success' => false,
                'message' => 'No resident or profile found with the provided ID.'
            ], 404);
        } catch (\Exception $e) {
            if (\DB::transactionLevel() > 0) {
                \DB::rollBack();
            }
            
            \Log::error('Residency verification approval failed', [
                'resident_id' => $id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Failed to approve residency verification.',
                'error' => $e->getMessage()
            ], 500);
        }
    }
    
    // ❌ Deny residency verification
    public function denyVerification(Request $request, $id)
    {
        try {
            // Accept either resident id OR profile id for flexibility
            $resident = Resident::find($id);
            if (!$resident) {
                $resident = Resident::where('profile_id', $id)->first();
            }
            
            if (!$resident) {
                // Fallback: update Profile verification if Resident does not yet exist
                $profile = Profile::find($id);
                if ($profile) {
                    $request->validate([
                        'comment' => 'required|string|max:500'
                    ]);
                    $profile->verification_status = 'denied';
                    $profile->denial_reason = $request->input('comment');
                    $profile->save();

                    // Try to email profile user
                    $user = $profile->user;
                    if ($user && $user->email) {
                        try {
                            Mail::to($user->email)->send(new ResidencyVerificationDeniedMail($user, $request->input('comment')));
                        } catch (\Exception $e) {
                            \Log::warning('Failed to send profile-level denial email', [
                                'user_id' => $user->id,
                                'profile_id' => $profile->id,
                                'error' => $e->getMessage()
                            ]);
                        }
                    }

                    return response()->json([
                        'message' => 'Residency verification denied successfully (profile-level).',
                        'profile' => $profile
                    ], 200);
                }
                return response()->json(['message' => 'Resident not found.'], 404);
            }
            
            // Validate comment is provided
            $request->validate([
                'comment' => 'required|string|max:500'
            ]);
            
            // Update verification status
            $resident->verification_status = 'denied';
            $resident->denial_reason = $request->input('comment');
            $resident->save();
            // Keep profile in sync if it exists
            if ($resident->profile) {
                $resident->profile->verification_status = 'denied';
                $resident->profile->denial_reason = $request->input('comment');
                $resident->profile->save();
            }
            
            // Send email notification to resident
            $user = $resident->user;
            if ($user && $user->email) {
                \Log::info('Sending residency verification denial email', [
                    'user_id' => $user->id,
                    'user_email' => $user->email,
                    'resident_id' => $resident->id
                ]);
                
                try {
                    Mail::to($user->email)->send(new ResidencyVerificationDeniedMail($user, $request->input('comment')));
                } catch (\Exception $e) {
                    \Log::error('Failed to send residency verification denial email', [
                        'user_id' => $user->id,
                        'resident_id' => $resident->id,
                        'error' => $e->getMessage()
                    ]);
                }
            }
            
            return response()->json([
                'message' => 'Residency verification denied successfully.',
                'resident' => $resident
            ], 200);
        } catch (\Exception $e) {
            \Log::error('Residency verification denial failed', [
                'resident_id' => $id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'message' => 'Failed to deny residency verification.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    // 📤 Upload residency verification image only
    public function uploadResidencyVerification(Request $request)
    {
        try {
            $user = $request->user();
            // Validate the image
            $request->validate([
                'residency_verification_image' => 'required|image|mimes:jpeg,png,jpg|max:5120' // 5MB max
            ]);
            // Check if profile already exists
            $profile = Profile::where('user_id', $user->id)->first();
            if (!$profile) {
                // Create a minimal profile for residency verification
                $profile = new Profile();
                $profile->user_id = $user->id;
                $profile->email = $user->email;
                $profile->verification_status = 'pending';
                // Generate a unique resident_id using user_id and timestamp
                $profile->resident_id = 'R-' . $user->id . '-' . time();
                $profile->save();
                \Log::info('Created new profile for residency verification', [
                    'user_id' => $user->id,
                    'profile_id' => $profile->id
                ]);
            }
            // Handle image upload
            if ($request->hasFile('residency_verification_image')) {
                // Delete old image if exists
                if ($profile->residency_verification_image) {
                    \Storage::disk('public')->delete($profile->residency_verification_image);
                }
                // Store new image
                $imagePath = $request->file('residency_verification_image')->store('residency_verification_images', 'public');
                $profile->residency_verification_image = $imagePath;
                $profile->verification_status = 'pending'; // Reset to pending for review
                $profile->denial_reason = null; // Clear any previous denial reason
                $profile->save();
                \Log::info('Residency verification image uploaded successfully', [
                    'user_id' => $user->id,
                    'profile_id' => $profile->id,
                    'image_path' => $imagePath
                ]);
                // Notify all admins
                $admins = \App\Models\User::where('role', 'admin')->get();
                foreach ($admins as $admin) {
                    $admin->notify(new \App\Notifications\ResidencyVerificationReuploaded($user));
                }
            }
            return response()->json([
                'message' => 'Residency verification image uploaded successfully. Please wait for admin approval.',
                'profile' => $profile->fresh(),
                'image_path' => $imagePath ?? null
            ], 200);
            
        } catch (\Exception $e) {
            \Log::error('Residency verification upload failed', [
                'user_id' => $request->user()->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'message' => 'Failed to upload residency verification image.',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}