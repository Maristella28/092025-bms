import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Helper to check if a profile is truly complete
function isProfileComplete(profile) {
  if (!profile) return false;
  // If backend says profile_completed is 1 or '1', treat as complete
  if (profile.profile_completed === 1 || profile.profile_completed === '1' || profile.profile_completed === true) {
    return true;
  }
  // Otherwise, check for required fields (customize as needed)
  const requiredFields = [
    'first_name', 'last_name', 'birth_date', 'email', 'contact_number',
    'sex', 'civil_status', 'religion', 'full_address', 'years_in_barangay', 'voter_status',
  ];
  return requiredFields.every(field => profile[field]);
}

// Helper to check if residency verification is complete
function isResidencyVerificationComplete(profile) {
  if (!profile) return false;
  // Check if residency verification is approved
  return profile.verification_status === 'approved';
}

const ProtectedRoute = ({ children, role }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen text-lg">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Mandatory profile completion and residency verification for residents
  if (user.role === 'residents') {
    // If residency verification is denied, show an error page or redirect to a specific page
    if (user.profile && user.profile.verification_status === 'denied') {
      // Redirect to a page that shows the denial message
      return <Navigate to="/residency-denied" replace />;
    }
    // Allow access to certain resident pages even if profile is incomplete or residency is not approved
    const allowedPaths = [
      '/residents/dashboard',
      '/residents/projects',
      '/residents/requestDocuments',
      '/residents/requestAssets',
      '/residents/blotterAppointment',
      '/residents/organizationalChart',
    ];
    const isAllowed = allowedPaths.includes(location.pathname);
    if (!isAllowed) {
      if (!isProfileComplete(user.profile) && location.pathname !== '/user/profile') {
        return <Navigate to="/user/profile" replace />;
      }
      if (!isResidencyVerificationComplete(user.profile) && location.pathname !== '/user/profile') {
        return <Navigate to="/user/profile" replace />;
      }
    }
  }

  // Optional: role-based protection
  if (role && user.role !== role) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
