import React, { useState, useEffect } from 'react';
import axiosInstance from '../../../../utils/axiosConfig';
import { toast } from 'react-toastify';

const StaffManagement = () => {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'staff',
    department: '',
    contactNumber: '',
    address: '',
    birthdate: '',
    gender: '',
    civilStatus: '',
    position: '',
    selectedResident: '',
    searchQuery: '', // Added for resident search
  });

  const [searchResults, setSearchResults] = useState([]); // State for search results
  const [isSearching, setIsSearching] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const searchTimeout = React.useRef(null);

  // Debounced resident search handler
  const handleResidentSearch = React.useCallback(async (searchValue) => {
    // Clear previous timeout
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    if (!searchValue || searchValue.length < 1) {
      setSearchResults([]);
      return;
    }

    // Set new timeout for debouncing
    searchTimeout.current = setTimeout(async () => {
      try {
        setIsSearching(true);
        const response = await axiosInstance.get(`/api/admin/residents/search?search=${searchValue}`);
        
        if (response.data) {
          setSearchResults(response.data);
        }
      } catch (error) {
        console.error('Error searching residents:', error);
        toast.error(
          error.response?.data?.message || 
          'Failed to search residents. Please try again.'
        );
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300); // 300ms debounce
  }, []);

  // Fetch staff list
  const fetchStaff = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get('/api/admin/staff');
      if (response.data && Array.isArray(response.data)) {
        setStaff(response.data);
      } else if (response.data && Array.isArray(response.data.staff)) {
        setStaff(response.data.staff);
      } else {
        console.warn('Unexpected staff data format:', response.data);
        setStaff([]);
      }
    } catch (error) {
      console.error('Error fetching staff:', error);
      toast.error(error.response?.data?.message || 'Failed to load staff list');
      setStaff([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when field is edited
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  // Validate form
  const validateForm = () => {
    const errors = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    }
    
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Invalid email format';
    }
    
    if (!formData.password || formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }
    
    if (!formData.department.trim()) {
      errors.department = 'Department is required';
    }
    
    if (!formData.contactNumber.trim()) {
      errors.contactNumber = 'Contact number is required';
    } else if (!/^\d{11}$/.test(formData.contactNumber)) {
      errors.contactNumber = 'Contact number must be 11 digits';
    }

    if (!formData.position.trim()) {
      errors.position = 'Position is required';
    }

    if (!formData.birthdate) {
      errors.birthdate = 'Birth date is required';
    } else {
      const birthDate = new Date(formData.birthdate);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      if (age < 18) {
        errors.birthdate = 'Staff must be at least 18 years old';
      }
    }

    if (!formData.gender) {
      errors.gender = 'Gender is required';
    }

    if (!formData.civilStatus) {
      errors.civilStatus = 'Civil status is required';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      // First ensure CSRF token is set
      await fetch('/sanctum/csrf-cookie', { credentials: 'include' });

      const response = await axiosInstance.post('/api/admin/staff', formData);
      toast.success('Staff account created successfully');
      setShowModal(false);
      fetchStaff(); // Refresh staff list
      setFormData({ // Reset form
        name: '',
        email: '',
        password: '',
        role: 'staff',
        department: '',
        contactNumber: '',
        position: '',
        birthdate: '',
        gender: '',
        civilStatus: '',
        address: '',
        selectedResident: '',
      });
    } catch (error) {
      console.error('Error creating staff account:', error);
      toast.error(error.response?.data?.message || 'Failed to create staff account');
    }
  };

  // Handle staff account deactivation
  const handleDeactivate = async (staffId) => {
    if (!window.confirm('Are you sure you want to deactivate this staff account?')) {
      return;
    }

    try {
      await axiosInstance.post(`/api/admin/staff/${staffId}/deactivate`);
      toast.success('Staff account deactivated successfully');
      fetchStaff(); // Refresh list
    } catch (error) {
      console.error('Error deactivating staff account:', error);
      toast.error('Failed to deactivate staff account');
    }
  };

  return (
    <div className="min-h-screen pt-20 px-4 lg:ml-64">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">Staff Management</h1>
              <p className="text-gray-600">Manage staff accounts and permissions</p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Create Staff Account
            </button>
          </div>
        </div>

        {/* Staff List */}
        <div className="bg-white shadow overflow-hidden rounded-lg">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 table-fixed">
            <thead className="bg-green-600">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider w-1/4">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider w-1/4">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider w-1/6">
                  Department
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider w-1/6">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider w-1/12">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider w-1/12">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600"></div>
                    </div>
                  </td>
                </tr>
              ) : staff.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      <p className="text-gray-500">No staff accounts found</p>
                      <p className="text-gray-400 text-sm">Click the "Create Staff Account" button to add staff members</p>
                    </div>
                  </td>
                </tr>
              ) : (
                staff.map((member) => (
                  <tr key={member.id} className="hover:bg-green-50 transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0">
                          <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                            <span className="text-green-800 font-semibold text-lg">
                              {member.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{member.name}</div>
                          <div className="text-sm text-gray-500">{member.role}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{member.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{member.department}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{member.contactNumber}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        member.active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {member.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {member.active && (
                        <button
                          onClick={() => handleDeactivate(member.id)}
                          className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 px-3 py-1 rounded-lg transition-colors duration-150"
                        >
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {/* Create Staff Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 bg-green-600">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">Create Staff Account</h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-white hover:text-gray-200 transition-colors"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                {/* Resident Selector */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Search Resident (Optional)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-xl text-sm transition-all duration-200"
                      placeholder="Type to search residents..."
                      value={formData.searchQuery || ''}
                      onChange={(e) => {
                        const searchValue = e.target.value;
                        setFormData(prev => ({ ...prev, searchQuery: searchValue }));
                        handleResidentSearch(searchValue);
                      }}
                      onFocus={() => {
                        if (formData.searchQuery) {
                          handleResidentSearch(formData.searchQuery);
                        }
                      }}
                    />
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  {searchResults.length > 0 && formData.searchQuery && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                      <div className="sticky top-0 bg-gray-50 px-4 py-2 text-xs font-medium text-gray-500 border-b">
                        Found {searchResults.length} resident(s)
                      </div>
                      {isSearching ? (
                        <div className="px-4 py-3 text-center text-gray-500">
                          <svg className="animate-spin h-5 w-5 mx-auto mb-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Searching...
                        </div>
                      ) : searchResults.length === 0 ? (
                        <div className="px-4 py-3 text-center text-gray-500">
                          No residents found
                        </div>
                      ) : searchResults.map((resident) => (
                        <div
                          key={resident.id}
                          className="px-4 py-3 hover:bg-green-50 cursor-pointer transition-colors duration-150 border-b last:border-b-0"
                          onClick={() => {
                            // Extract and format resident data with fallbacks
                            const formattedData = {
                              selectedResident: resident.id ? resident.id.toString() : '',
                              searchQuery: `${resident.first_name} ${resident.last_name}`,
                              name: `${resident.first_name} ${resident.last_name}`,
                              contactNumber: resident.mobile_number || 
                                          resident.contact_number || 
                                          resident.phone || '',
                              email: resident.email || 
                                    resident.email_address || '',
                              address: resident.current_address || 
                                      resident.full_address || 
                                      resident.address || '',
                              birthdate: resident.birth_date || 
                                       resident.birthdate || '',
                              gender: (resident.sex || resident.gender || '')
                                     .toLowerCase(),
                              civilStatus: (resident.civil_status || 
                                          resident.civilStatus || '')
                                         .toLowerCase(),
                            };

                            // Remove any undefined values
                            Object.keys(formattedData).forEach(key => {
                              if (formattedData[key] === undefined) {
                                formattedData[key] = '';
                              }
                            });

                            setFormData(prev => ({
                              ...prev,
                              ...formattedData
                            }));

                            // Show success message
                            toast.success('Resident information loaded successfully');
                            
                            // Clear search results
                            setSearchResults([]);
                          }}
                        >
                          <div className="flex items-center group">
                            <div className="flex-shrink-0">
                              <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center group-hover:bg-green-200 transition-colors duration-200">
                                <span className="text-green-800 font-medium">
                                  {resident.first_name?.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            </div>
                            <div className="ml-3 flex-1">
                              <div className="font-medium text-sm text-gray-900 group-hover:text-green-600 transition-colors duration-200">
                                {resident.first_name} {resident.last_name}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span>ID: {resident.resident_id || resident.id || 'N/A'}</span>
                                {resident.email && (
                                  <>
                                    <span className="text-gray-300">•</span>
                                    <span className="truncate">{resident.email}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                              <svg className="h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Name</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm ${
                        formErrors.name ? 'border-red-500' : ''
                      }`}
                    />
                    {formErrors.name && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm ${
                        formErrors.email ? 'border-red-500' : ''
                      }`}
                    />
                    {formErrors.email && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Password</label>
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm ${
                        formErrors.password ? 'border-red-500' : ''
                      }`}
                    />
                    {formErrors.password && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.password}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Contact Number</label>
                    <input
                      type="text"
                      name="contactNumber"
                      value={formData.contactNumber}
                      onChange={handleInputChange}
                      className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm ${
                        formErrors.contactNumber ? 'border-red-500' : ''
                      }`}
                    />
                    {formErrors.contactNumber && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.contactNumber}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Department</label>
                    <input
                      type="text"
                      name="department"
                      value={formData.department}
                      onChange={handleInputChange}
                      className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm ${
                        formErrors.department ? 'border-red-500' : ''
                      }`}
                    />
                    {formErrors.department && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.department}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Position</label>
                    <input
                      type="text"
                      name="position"
                      value={formData.position}
                      onChange={handleInputChange}
                      className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm ${
                        formErrors.position ? 'border-red-500' : ''
                      }`}
                    />
                    {formErrors.position && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.position}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Birth Date</label>
                    <input
                      type="date"
                      name="birthdate"
                      value={formData.birthdate}
                      onChange={handleInputChange}
                      className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm ${
                        formErrors.birthdate ? 'border-red-500' : ''
                      }`}
                    />
                    {formErrors.birthdate && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.birthdate}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Gender</label>
                    <select
                      name="gender"
                      value={formData.gender}
                      onChange={handleInputChange}
                      className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm ${
                        formErrors.gender ? 'border-red-500' : ''
                      }`}
                    >
                      <option value="">Select Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                    {formErrors.gender && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.gender}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Civil Status</label>
                  <select
                    name="civilStatus"
                    value={formData.civilStatus}
                    onChange={handleInputChange}
                    className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm ${
                      formErrors.civilStatus ? 'border-red-500' : ''
                    }`}
                  >
                    <option value="">Select Civil Status</option>
                    <option value="single">Single</option>
                    <option value="married">Married</option>
                    <option value="divorced">Divorced</option>
                    <option value="widowed">Widowed</option>
                  </select>
                  {formErrors.civilStatus && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.civilStatus}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Address</label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    rows="2"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3 border-t pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-green-600 px-4 py-2 rounded-md text-white text-sm font-medium hover:bg-green-700"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffManagement;