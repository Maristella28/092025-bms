import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Upload, Camera, AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react';
import Navbares from '../components/Navbares';
import Sidebares from '../components/Sidebares';
import axiosInstance from '../utils/axiosConfig';

const ResidencyVerification = () => {
  const { user, forceRefresh } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    verification_status: null,
    residency_verification_image: null,
    denial_reason: null
  });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await axiosInstance.get('/profile');
      if (response.data.profile) {
        setForm(response.data.profile);
        
        // If verification is approved, redirect to profile
        if (response.data.profile.verification_status === 'approved') {
          navigate('/user/profile');
          return;
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Please upload a valid image file (JPG, PNG, etc.)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image size must be less than 5MB');
      return;
    }

    setUploadError('');
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('residency_verification_image', file);

      const response = await axiosInstance.post('/profile/upload-residency-verification', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setForm(prev => ({
        ...prev,
        residency_verification_image: response.data.image_path,
        verification_status: 'pending'
      }));

      await forceRefresh();
      alert('Residency verification document uploaded successfully! Please wait for admin approval.');
      
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError(error.response?.data?.message || 'Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex flex-col font-sans">
        <Navbares />
        <Sidebares />
        <main className="flex-1 flex flex-col items-center justify-center w-full py-8">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-blue-600 font-semibold">Loading...</p>
          </div>
        </main>
      </div>
    );
  }

  if (form.verification_status === 'approved') {
          navigate('/user/profile');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex flex-col font-sans">
      <Navbares />
      <Sidebares />
      <main className="flex-1 flex flex-col items-center justify-center w-full py-8">
        <div className="w-full max-w-5xl mx-auto px-2 sm:px-8 lg:px-12 pb-16 flex flex-col items-center justify-center">
          <div className="w-full max-w-2xl mb-6">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-800 mb-2">
                Welcome to Barangay Mamatid!
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                To complete your registration and access your profile, please upload a proof of residency document. 
                This document will be reviewed by barangay administrators to verify your residency in our barangay.
              </p>
            </div>
          </div>
          <div className="bg-white/95 shadow-xl rounded-3xl border border-gray-100 overflow-hidden mt-4 mb-10 w-full max-w-5xl mx-auto flex flex-col items-center" style={{zIndex: 20, position: 'relative'}}>
            <div className="p-6 md:p-14 flex flex-col items-center w-full">
              <div className="flex flex-col items-center w-full">
                <ResidencyVerificationContent 
                  form={form} 
                  onImageUpload={handleImageUpload}
                  uploading={uploading}
                  uploadError={uploadError}
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
 };

// Separate component for the residency verification content
const ResidencyVerificationContent = ({ form, onImageUpload, uploading, uploadError }) => {
  // If residency verification is denied, show a message with re-upload option
  if (form.verification_status === 'denied') {
    return (
      <div className="w-full bg-red-50 rounded-xl flex flex-col items-center py-8 shadow-sm border border-red-200">
        <div className="flex items-center gap-3 mb-4">
          <XCircle className="w-12 h-12 text-red-600" />
          <h3 className="text-2xl font-bold text-red-800">Residency Verification Denied</h3>
        </div>
        <p className="text-sm text-red-600 mt-2 text-center mb-4">
          Your residency verification has been denied by barangay administrators.
        </p>
        {form.denial_reason && (
          <div className="mt-4 p-4 bg-red-100 border border-red-300 rounded-lg mb-6 w-full max-w-md">
            <p className="text-sm font-semibold text-red-800">Reason for denial:</p>
            <p className="text-sm text-red-700">{form.denial_reason}</p>
          </div>
        )}
        
        {/* Re-upload section */}
        <div className="w-full max-w-md space-y-4">
          <p className="text-sm text-red-700 text-center font-medium">
            Please upload a new document that addresses the concerns mentioned above:
          </p>
          <label className="cursor-pointer bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all duration-200">
            <input
              type="file"
              accept="image/*"
              onChange={onImageUpload}
              className="hidden"
              disabled={uploading}
            />
            {uploading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                Re-upload Document
              </>
            )}
          </label>
          {uploadError && (
            <p className="text-red-600 text-sm text-center">{uploadError}</p>
          )}
        </div>
      </div>
    );
  }

  // If residency verification is pending, show a message
  if ((form.verification_status === 'pending' || form.verification_status === 'denied') && form.residency_verification_image) {
    return (
      <div className="w-full bg-blue-50 rounded-xl flex flex-col items-center py-8 shadow-sm border border-blue-200">
        <div className="flex items-center gap-3 mb-4">
          <Clock className="w-12 h-12 text-blue-600" />
          <h3 className="text-2xl font-bold text-blue-800">Residency Verification Pending</h3>
        </div>
        <p className="text-sm text-blue-600 mt-2 text-center mb-4">
          Your residency verification document is being reviewed by barangay administrators.
        </p>
        <div className="w-full max-w-md space-y-4">
          <div className="bg-blue-100 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-blue-600" />
              <span className="text-blue-800 font-semibold text-sm">Document Uploaded</span>
            </div>
            <p className="text-blue-700 text-sm">
              Please wait for admin approval. You will be notified once the verification is complete.
            </p>
          </div>
          
          {form.residency_verification_image && (
            <div className="text-center">
              <p className="text-blue-600 text-sm mb-3 font-medium">Uploaded Document:</p>
              <img
                src={`http://localhost:8000/storage/${form.residency_verification_image}?t=${Date.now()}`}
                alt="Residency Verification"
                className="w-48 h-48 object-cover rounded-lg border-4 border-blue-400 shadow-lg mx-auto"
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // If status is pending but no image exists (edge case), show upload prompt
  if (form.verification_status === 'pending' && !form.residency_verification_image) {
    return (
      <div className="w-full bg-orange-50 rounded-xl flex flex-col items-center py-8 shadow-sm border-2 border-orange-200">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className="w-12 h-12 text-orange-600" />
          <h3 className="text-xl font-bold text-orange-800">Residency Verification Required</h3>
        </div>
        <p className="text-sm text-orange-600 mt-2 text-center mb-4">
          Your verification status is pending but no document was found. Please upload your residency verification document.
        </p>
        <div className="w-full max-w-md space-y-4">
          <div className="bg-white rounded-lg p-6 border border-orange-200 shadow-sm">
            <div className="flex items-center justify-center w-full">
              <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-orange-300 border-dashed rounded-lg cursor-pointer bg-orange-50 hover:bg-orange-100 transition-all duration-200">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  {uploading ? (
                    <>
                      <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                      <p className="text-orange-600 font-semibold">Uploading document...</p>
                    </>
                  ) : (
                    <>
                      <Camera className="w-12 h-12 text-orange-500 mb-4" />
                      <p className="mb-2 text-sm text-orange-700 font-semibold">
                        <span>Click to upload your residency document</span>
                      </p>
                      <p className="text-xs text-orange-600">PNG, JPG or JPEG (MAX. 5MB)</p>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={onImageUpload}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
            </div>
            
            {uploadError && (
              <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded-lg">
                <p className="text-red-700 text-sm">{uploadError}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // If there's no residency verification image, show the upload prompt
  return (
    <div className="w-full bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl flex flex-col items-center py-8 shadow-lg border-2 border-orange-200">
      <div className="flex items-center gap-3 mb-4">
        <AlertCircle className="w-12 h-12 text-orange-600" />
        <h3 className="text-2xl font-bold text-orange-800">Residency Verification Required</h3>
      </div>
      
      <div className="w-full max-w-2xl space-y-6">
        <div className="bg-white rounded-lg p-6 border border-orange-200 shadow-sm">
          <h4 className="text-lg font-semibold text-orange-800 mb-3">📋 What you need to upload:</h4>
          <ul className="text-sm text-orange-700 space-y-2">
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
              Utility bill (electricity, water, internet)
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
              Lease agreement or rental contract
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
              Barangay certificate of residency
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
              Property deed or similar proof of residence
            </li>
          </ul>
        </div>

        <div className="bg-white rounded-lg p-6 border border-orange-200 shadow-sm">
          <div className="flex items-center justify-center w-full">
            <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-orange-300 border-dashed rounded-lg cursor-pointer bg-orange-50 hover:bg-orange-100 transition-all duration-200">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                {uploading ? (
                  <>
                    <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-orange-600 font-semibold">Uploading document...</p>
                  </>
                ) : (
                  <>
                    <Camera className="w-12 h-12 text-orange-500 mb-4" />
                    <p className="mb-2 text-sm text-orange-700 font-semibold">
                      <span>Click to upload your residency document</span>
                    </p>
                    <p className="text-xs text-orange-600">PNG, JPG or JPEG (MAX. 5MB)</p>
                  </>
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={onImageUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>
          </div>
          
          {uploadError && (
            <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded-lg">
              <p className="text-red-700 text-sm">{uploadError}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResidencyVerification;
