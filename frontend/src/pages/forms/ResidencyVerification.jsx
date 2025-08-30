import React, { useState } from 'react';
import { Upload, Camera, AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react';
import axiosInstance from '../../utils/axiosConfig';

const ResidencyVerification = ({ form, onImageUpload, isFirstTime = false }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setUploadError('Please upload a valid image file (JPG, PNG, etc.)');
      return;
    }

    // Validate file size (max 5MB)
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

      // Notify parent component about the upload
      if (onImageUpload) {
        onImageUpload(response.data);
      }

      // Optionally refresh the page or update form data
      window.location.reload();
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError(error.response?.data?.message || 'Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };
  // If residency is already verified, don't show this component
  if (form.verification_status === 'approved') {
    return null;
  }

  // If residency verification is denied, show a message with re-upload option
  if (form.verification_status === 'denied') {
    return (
      <div className="w-full bg-red-50 rounded-xl flex flex-col items-center py-8 shadow-sm mt-8">
        <div className="flex items-center gap-3 mb-4">
          <XCircle className="w-8 h-8 text-red-600" />
          <h3 className="text-xl font-bold text-red-800">Residency Verification Denied</h3>
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
              onChange={handleImageUpload}
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
      <div className="w-full bg-blue-50 rounded-xl flex flex-col items-center py-8 shadow-sm mt-8">
        <div className="flex items-center gap-3 mb-4">
          <Clock className="w-8 h-8 text-blue-600" />
          <h3 className="text-xl font-bold text-blue-800">Residency Verification Pending</h3>
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
              Please wait for admin approval. You will be notified via email once the verification is complete.
            </p>
          </div>
          
          {form.residency_verification_image && (
            <div className="text-center">
              <p className="text-blue-600 text-sm mb-3 font-medium">Uploaded Document:</p>
              <img
                src={
                  typeof form.residency_verification_image === 'string'
                    ? `http://localhost:8000/storage/${form.residency_verification_image}?t=${Date.now()}`
                    : URL.createObjectURL(form.residency_verification_image)
                }
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
      <div className="w-full bg-orange-50 rounded-xl flex flex-col items-center py-8 shadow-sm mt-8 border-2 border-orange-200">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className="w-10 h-10 text-orange-600" />
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
                  onChange={handleImageUpload}
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

  // If there's no residency verification image and residency is not verified,
  // show the upload prompt with enhanced first-time experience
  if (!form.residency_verification_image) {
    return (
      <div id="residency-verification-section" className="w-full bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl flex flex-col items-center py-8 shadow-lg mt-8 border-2 border-orange-200">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className="w-10 h-10 text-orange-600" />
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
                  onChange={handleImageUpload}
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

          <div className="bg-amber-100 border border-amber-300 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              <span className="text-amber-800 font-semibold text-sm">Important Notice</span>
            </div>
            <p className="text-amber-700 text-sm">
              You cannot edit your profile until this document is reviewed and approved by barangay administrators. 
              Please ensure the document is clear and legible.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // If there's a residency verification image, show it for review
  return (
    <div className="w-full bg-blue-50 rounded-xl flex flex-col items-center py-8 shadow-sm mt-8">
      <h3 className="text-xl font-bold text-blue-800 mb-6">Residency Verification Document</h3>
      <div className="relative">
        <img
          src={
            typeof form.residency_verification_image === 'string'
              ? `http://localhost:8000/storage/${form.residency_verification_image}?t=${Date.now()}`
              : URL.createObjectURL(form.residency_verification_image)
          }
          alt="Residency Verification"
          className="w-48 h-48 object-cover rounded-lg border-4 border-blue-400 shadow-lg"
        />
      </div>
      <p className="text-sm text-blue-600 mt-4 text-center">
        This document is being reviewed by barangay administrators.
      </p>
    </div>
  );
};

export default ResidencyVerification;