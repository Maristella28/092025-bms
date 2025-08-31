<?php

namespace App\Models;

use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable implements MustVerifyEmail
{
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'has_logged_in',
        'verification_code',
        'verification_code_expires_at',
        'email_verified_at',
        'privacy_policy_accepted',
        'privacy_policy_accepted_at',
        'residency_status',
        'last_activity_at',
        'status_updated_at',
        'status_notes',
        'status_updated_by',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
        'verification_code',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'email_verified_at' => 'datetime',
        'verification_code_expires_at' => 'datetime',
        'privacy_policy_accepted' => 'boolean',
        'privacy_policy_accepted_at' => 'datetime',
        'last_activity_at' => 'datetime',
        'status_updated_at' => 'datetime',
    ];

    // ✅ One-to-One Relationship with Profile
    public function profile()
    {
        return $this->hasOne(Profile::class);
    }

    public function resident()
    {
        return $this->hasOne(\App\Models\Resident::class, 'user_id');
    }

    /**
     * Relationship to the user who updated this user's status
     */
    public function statusUpdatedBy()
    {
        return $this->belongsTo(User::class, 'status_updated_by');
    }

    /**
     * Check if verification code is expired
     */
    public function isVerificationCodeExpired()
    {
        return $this->verification_code_expires_at && $this->verification_code_expires_at->isPast();
    }

    /**
     * Check if user is fully registered (email verified)
     */
    public function isFullyRegistered()
    {
        return $this->hasVerifiedEmail();
    }

    /**
     * Update user's last activity timestamp
     */
    public function updateLastActivity()
    {
        $this->update(['last_activity_at' => now()]);
    }

    /**
     * Update residency status
     */
    public function updateResidencyStatus($status, $notes = null, $updatedBy = null)
    {
        $this->update([
            'residency_status' => $status,
            'status_updated_at' => now(),
            'status_notes' => $notes,
            'status_updated_by' => $updatedBy,
        ]);
    }

    /**
     * Check if user is inactive (no activity for 1 year)
     */
    public function isInactive()
    {
        return $this->last_activity_at && $this->last_activity_at->addYear()->isPast();
    }

    /**
     * Check if user needs review
     */
    public function needsReview()
    {
        return $this->residency_status === 'for_review' || $this->isInactive();
    }

    /**
     * Get residency status badge color
     */
    public function getStatusBadgeColor()
    {
        return match($this->residency_status) {
            'active' => 'green',
            'inactive' => 'yellow',
            'for_review' => 'orange',
            'deceased' => 'red',
            'relocated' => 'blue',
            default => 'gray',
        };
    }

    /**
     * Get residency status display name
     */
    public function getStatusDisplayName()
    {
        return match($this->residency_status) {
            'active' => 'Active',
            'inactive' => 'Inactive',
            'for_review' => 'For Review',
            'deceased' => 'Deceased',
            'relocated' => 'Relocated',
            default => 'Unknown',
        };
    }
}
