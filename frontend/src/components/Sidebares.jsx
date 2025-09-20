import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Lightbulb, FileText, Package, CalendarDays,
  Network, UserSquare, ClipboardList, AlertCircle
} from 'lucide-react';
import axiosInstance from '../utils/axiosConfig';
import { isProfileComplete, getMissingFields } from '../utils/profileValidation';

const Sidebares = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [profileStatus, setProfileStatus] = useState({ isComplete: false, loading: true });
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    const checkProfileStatus = async () => {
      try {
        // Try to get profile data
        let response;
        try {
          response = await axiosInstance.get('/profile');
        } catch (firstErr) {
          console.warn('First profile endpoint failed, trying fallback:', firstErr);
          response = await axiosInstance.get('/user/profile');
        }

    // Backend often returns { user: ..., profile: { ... } }
    // Normalize to the actual profile object when present
  const raw = response.data;
  let profile = null;
  if (raw && raw.profile) profile = raw.profile;
  else if (raw && raw.user && raw.user.profile) profile = raw.user.profile;
  else profile = raw;

  const missingFields = getMissingFields(profile);
  const completeFromFn = isProfileComplete(profile);
  // Be defensive: require both checks to agree (no missing fields and fn=true)
  const complete = completeFromFn && missingFields.length === 0;

  console.log('Profile Data:', profile);
  console.log('resident_id:', profile && profile.resident_id);
  console.log('Missing Fields:', missingFields);
  console.log('Missing count:', missingFields.length);
  console.log('isProfileComplete() returned:', completeFromFn);
  console.log('Computed Is Complete:', complete);

        // Compute completeness
        let finalComplete = complete;

        // If verification is denied or residency verification image missing, require action
        if (profile && (profile.verification_status === 'denied' || !profile.residency_verification_image)) {
          finalComplete = false;
        }

  setProfileStatus({ isComplete: finalComplete, loading: false, profile, raw });
      } catch (error) {
        console.error('Error checking profile status:', error);
        // Don't block navigation if we can't check the profile
        setProfileStatus({ isComplete: true, loading: false });
      }
    };

    checkProfileStatus();

    // Poll profile every 8 seconds to pick up admin-made permission changes
    const interval = setInterval(() => {
      checkProfileStatus();
    }, 8000);

    // Also re-check when tab becomes visible again
    const onVisibility = () => {
      if (document.visibilityState === 'visible') checkProfileStatus();
    };
    document.addEventListener('visibilitychange', onVisibility);
    
    // Listen for manual profile update events
    const onProfileUpdated = () => {
      console.log('Profile update event received, refreshing status');
      checkProfileStatus();
    };
    window.addEventListener('profile-updated', onProfileUpdated);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('profile-updated', onProfileUpdated);
    };
  }, []);

  const handleNavigation = (e, path) => {
    if (!profileStatus.isComplete && path !== '/user/profile') {
      e.preventDefault();
      setShowWarning(true);

      // If profile exists but verification denied, send to residency-denied page
      const profile = profileStatus.profile;
      if (profile && profile.verification_status === 'denied') {
        setTimeout(() => navigate('/residency-denied'), 800);
        return;
      }

      // If residency verification image missing or verification pending, send to verification page
      if (profile && !profile.residency_verification_image) {
        setTimeout(() => navigate('/residency-verification'), 800);
        return;
      }

      // Otherwise redirect to profile edit page
      setTimeout(() => navigate('/user/profile'), 800);
    }
  };

  // Route-guard effect: if the profile is incomplete and the user is on a protected route,
  // redirect them immediately (this blocks direct URL access as well as link clicks)
  useEffect(() => {
    if (profileStatus.loading) return;

    const protectedPrefixes = ['/residents'];
    const isProtected = protectedPrefixes.some(prefix => location.pathname.startsWith(prefix));

    if (!profileStatus.isComplete && isProtected && location.pathname !== '/user/profile') {
      setShowWarning(true);
      const profile = profileStatus.profile;

      if (profile && profile.verification_status === 'denied') {
        navigate('/residency-denied');
        return;
      }

      if (profile && !profile.residency_verification_image) {
        navigate('/residency-verification');
        return;
      }

      navigate('/user/profile');
    }
  }, [profileStatus, location.pathname, navigate]);

  const menuItems = [
    { title: "Dashboard", icon: <LayoutDashboard size={18} />, path: "/residents/dashboard" },
    { title: "Projects", icon: <Lightbulb size={18} />, path: "/residents/projects" },
    // My Benefits will be conditionally inserted below based on profile permissions
    { title: "Request Documents", icon: <FileText size={18} />, path: "/residents/requestDocuments" },
    { title: "Request Assets", icon: <Package size={18} />, path: "/residents/requestAssets" },
    { title: "Blotter Appointment", icon: <CalendarDays size={18} />, path: "/residents/blotterAppointment" },
    { title: "Organizational Chart", icon: <Network size={18} />, path: "/residents/organizationalChart" },
  ];

    // If the profile has a permission flag set by admin, show My Benefits
  const canSeeMyBenefits = (() => {
    const p = profileStatus.profile;
    const raw = profileStatus.raw;
    if (!p) return false;
    
    // Support multiple possible keys set by backend
    let perms = p.permissions;
    try {
      if (typeof perms === 'string' && perms.trim() !== '') {
        perms = JSON.parse(perms);
      }
    } catch (e) {
      // leave as-is if parse fails
      console.warn('Failed to parse profile.permissions JSON', e);
      perms = null; // Reset if parsing failed
    }

    // Add detailed console logs for debugging
    console.log('Raw profile data:', p);
    console.log('Raw response data:', raw);
    console.log('Permission Check Details:', {
      profile_permissions: p.permissions,
      parsed_perms: perms,
      my_benefits_enabled: p.my_benefits_enabled,
      profile_my_benefits: p.my_benefits,
      raw_permissions: raw?.permissions,
      raw_user_permissions: raw?.user?.permissions,
      raw_enabled: raw?.my_benefits_enabled,
      raw_user_enabled: raw?.user?.my_benefits_enabled
    });

    // More lenient check for enabled status
    const isEnabled = !!(
      // Check profile level flags
      p.my_benefits_enabled === true ||
      p.my_benefits_enabled === 'true' ||
      p.my_benefits_enabled === 1 ||
      p.my_benefits === true ||
      p.my_benefits === 'true' ||
      p.my_benefits === 1 ||
      // Check permissions object if it exists
      (perms && (
        perms.my_benefits === true ||
        perms.my_benefits === 'true' ||
        perms.my_benefits === 1
      )) ||
      // Check raw response level
      raw?.my_benefits_enabled === true ||
      raw?.my_benefits_enabled === 'true' ||
      raw?.my_benefits_enabled === 1 ||
      // Check user level in raw response
      raw?.user?.my_benefits_enabled === true ||
      raw?.user?.my_benefits_enabled === 'true' ||
      raw?.user?.my_benefits_enabled === 1
    );

    console.log('My Benefits status check:', { 
      isEnabled,
      profile_enabled: p.my_benefits_enabled,
      profile_benefits: p.my_benefits,
      perms_check: perms && perms.my_benefits,
      raw_enabled: raw?.my_benefits_enabled,
      raw_user_enabled: raw?.user?.my_benefits_enabled
    });
    
    return isEnabled;
  })();

  if (canSeeMyBenefits) {
    // insert My Benefits right after Projects
    menuItems.splice(2, 0, { title: 'My Benefits', icon: <ClipboardList size={18} />, path: '/residents/my-benefits' });
  }

  return (
    <aside className="fixed top-0 left-0 z-40 w-64 h-screen bg-gradient-to-b from-green-900 to-green-800 shadow-2xl border-r border-green-700">
      <div className="flex flex-col h-full px-4 py-6 text-white space-y-6 overflow-y-auto scrollbar-thin scrollbar-thumb-green-600 scrollbar-track-green-800">
        
        {/* Logo or Brand Title */}
        <div className="flex items-center justify-center gap-3">
          <UserSquare className="text-lime-300 w-7 h-7" />
          <h2 className="text-2xl font-extrabold tracking-wide text-lime-100">Resident Panel</h2>
        </div>

        <hr className="border-green-700" />

        {/* Navigation */}
        <nav className="flex-1">
          {showWarning && (
            <div className="mb-4 p-4 bg-red-500 text-white rounded-lg shadow-lg animate-fade-in">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                <p className="text-sm">Please complete your profile first!</p>
              </div>
            </div>
          )}

          {profileStatus.loading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>
          ) : (
            <ul className="space-y-1">
              {menuItems.map((item, idx) => {
                const isActive = location.pathname === item.path;
                const isDisabled = !profileStatus.isComplete && item.path !== '/user/profile';
                
                return (
                  <li key={idx}>
                    {isDisabled ? (
                      // Render a non-interactive button/span when disabled so it can't navigate
                      <div
                        role="button"
                        aria-disabled="true"
                        onClick={(e) => handleNavigation(e, item.path)}
                        className={`flex items-center gap-4 px-4 py-3 rounded-lg transition-all duration-200 group opacity-50 cursor-not-allowed bg-gray-700 text-gray-300`}
                      >
                        <span className="text-white">{item.icon}</span>
                        <span className="truncate text-sm tracking-wide">{item.title}</span>
                        <span className="ml-auto">
                          <AlertCircle className="w-4 h-4 text-red-400" />
                        </span>
                      </div>
                    ) : (
                      <Link
                        to={item.path}
                        onClick={(e) => handleNavigation(e, item.path)}
                        className={`flex items-center gap-4 px-4 py-3 rounded-lg transition-all duration-200 group
                          ${isActive
                            ? "bg-green-700 text-white font-semibold shadow-inner border-l-4 border-lime-300"
                            : "hover:bg-green-700 hover:text-white text-green-100"
                          }`}
                      >
                        <span className="text-white group-hover:scale-110 transition-transform">{item.icon}</span>
                        <span className="truncate text-sm tracking-wide">{item.title}</span>
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          
          {!profileStatus.loading && !profileStatus.isComplete && (
            <div className="mt-4 p-4 bg-yellow-500/20 border border-yellow-600/30 rounded-lg">
              <p className="text-yellow-200 text-sm text-center">
                Complete your profile to access all features
              </p>
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="text-sm text-green-300 text-center pt-6 border-t border-green-700">
          <p>&copy; 2025 Barangay System</p>
        </div>
      </div>
      <style>{`
        .animate-fade-in {
          animation: fadeIn 0.3s ease-in-out;
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </aside>
  );
};

export default Sidebares;
