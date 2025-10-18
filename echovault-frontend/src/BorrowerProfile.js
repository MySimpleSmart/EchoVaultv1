import React, { useState, useEffect } from 'react';
import './BorrowerProfile.css';

const BorrowerProfile = ({ userEmail, onProfileComplete, onCancel, editingBorrower, isEditing }) => {
  const [formData, setFormData] = useState({
    // General Fields
    first_name: '',
    last_name: '',
    email_address: '', // Always start empty for new borrower creation
    date_of_birth: '',
    mobile_number: '',
    registration_number: '',
    home_address: '',
    // Personal Document Fields
    document_type: '',
    document_upload: null,
    // Social Links
    social_link_1: '',
    social_link_2: '',
    // Employment Fields
    employment_status: '',
    work_rights: '',
    employer_name: '',
    job_title: '',
    monthly_income_aud: '',
    employment_start_date: '',
    employer_phone: '',
    employer_email: '',
    employer_address: '',
    // Family Fields
    marital_status: '',
    family_relationship: '',
    family_member_full_name: '',
    family_member_phone: '',
    family_member_email: '',
    // Bank Fields
    bank_name: '',
    account_name: '',
    bsb_number: '',
    account_number: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [existingDocument, setExistingDocument] = useState(null);
  const [existingMediaDetails, setExistingMediaDetails] = useState(null);
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    // If editing, populate form with existing data
    if (isEditing && editingBorrower) {
      setFormData({
        first_name: editingBorrower.first_name || '',
        last_name: editingBorrower.last_name || '',
        email_address: editingBorrower.email_address || '',
        date_of_birth: editingBorrower.date_of_birth || '',
        mobile_number: editingBorrower.mobile_number || '',
        registration_number: editingBorrower.registration_number || '',
        home_address: editingBorrower.home_address || '',
        document_type: editingBorrower.document_type || '',
        document_upload: null, // Don't pre-populate file upload
        // Social Links
        social_link_1: editingBorrower.social_link_1 || '',
        social_link_2: editingBorrower.social_link_2 || '',
        // Employment Fields
        employment_status: editingBorrower.employment_status || '',
        work_rights: editingBorrower.work_rights || '',
        employer_name: editingBorrower.employer_name || '',
        job_title: editingBorrower.job_title || '',
        monthly_income_aud: editingBorrower.monthly_income_aud || '',
        employment_start_date: editingBorrower.employment_start_date || '',
        employer_phone: editingBorrower.employer_phone || '',
        employer_email: editingBorrower.employer_email || '',
        employer_address: editingBorrower.employer_address || '',
        // Family Fields
        marital_status: editingBorrower.marital_status || '',
        family_relationship: editingBorrower.family_relationship || '',
        family_member_full_name: editingBorrower.family_member_full_name || '',
        family_member_phone: editingBorrower.family_member_phone || '',
        family_member_email: editingBorrower.family_member_email || '',
        // Bank Fields
        bank_name: editingBorrower.bank_name || '',
        account_name: editingBorrower.account_name || '',
        bsb_number: editingBorrower.bsb_number || '',
        account_number: editingBorrower.account_number || ''
      });
      
      // Store existing document info for display
      if (editingBorrower.document_upload) {
        setExistingDocument(editingBorrower.document_upload);
        
        // Fetch media details if it's a media ID
        if (typeof editingBorrower.document_upload === 'number') {
          fetchMediaDetails(editingBorrower.document_upload);
        } else if (typeof editingBorrower.document_upload === 'object') {
          setExistingMediaDetails(editingBorrower.document_upload);
        }
      }
    }
  }, [isEditing, editingBorrower]);

  const fetchMediaDetails = async (mediaId) => {
    try {
      const token = localStorage.getItem('jwt_token');
      const response = await fetch(`${process.env.REACT_APP_API_URL}/wp/v2/media/${mediaId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const media = await response.json();
        setExistingMediaDetails(media);
      }
    } catch (err) {
      console.error('Error fetching media details:', err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, files } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'file' ? files[0] : value
    }));

    // Don't check email automatically - let user type freely
  };

  const checkEmailExists = async (email) => {
    if (!email) return;
    
    setCheckingEmail(true);
    setError('');

    try {
      const token = localStorage.getItem('jwt_token');
      
      if (!token) {
        setError('Authentication token not found. Please login again.');
        setCheckingEmail(false);
        return;
      }

      const response = await fetch(`${process.env.REACT_APP_API_URL}/wp/v2/borrower-profile`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const borrowers = await response.json();
        const emailExists = borrowers.some(borrower => 
          borrower.email_address && borrower.email_address.toLowerCase() === email.toLowerCase()
        );

        if (emailExists) {
          setError('This email address is already registered. Please use a different email.');
        }
      }
    } catch (err) {
      console.error('Error checking email:', err);
      // Don't show error for network issues during email check
    } finally {
      setCheckingEmail(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    // Basic validation - only require first name, last name, and email
    if (!formData.first_name.trim() || !formData.last_name.trim() || !formData.email_address.trim()) {
      setError('Please fill in First Name, Last Name, and Email Address.');
      setLoading(false);
      return;
    }

    // Check if email is being validated
    if (checkingEmail) {
      setError('Please wait while we verify the email address.');
      setLoading(false);
      return;
    }

    // Check if email already exists (only for new borrowers, not when editing)
    if (!isEditing) {
      const token = localStorage.getItem('jwt_token');
      if (token) {
        try {
          const response = await fetch(`${process.env.REACT_APP_API_URL}/wp/v2/borrower-profile`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          });

          if (response.ok) {
            const borrowers = await response.json();
            const emailExists = borrowers.some(borrower => 
              borrower.email_address && borrower.email_address.toLowerCase() === formData.email_address.toLowerCase()
            );

            if (emailExists) {
              setError('This email address is already registered. Please use a different email.');
              setLoading(false);
              return;
            }
          }
        } catch (err) {
          console.error('Error checking email during submission:', err);
        }
      }
    }

    if (!formData.document_type) {
      setError('Please select a document type.');
      setLoading(false);
      return;
    }

    // Validate file upload if provided
    if (formData.document_upload) {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf', 'image/gif'];
      const maxSize = 5 * 1024 * 1024; // 5MB

      if (!allowedTypes.includes(formData.document_upload.type)) {
        setError('Please upload a valid file type (JPEG, PNG, PDF, or GIF).');
        setLoading(false);
        return;
      }

      if (formData.document_upload.size > maxSize) {
        setError('File size must be less than 5MB.');
        setLoading(false);
        return;
      }
    }

    // Only require document upload for new borrowers, not when editing
    if (!isEditing && !formData.document_upload) {
      setError('Please upload a document.');
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem('jwt_token');
      
      if (!token) {
        setError('Authentication token not found. Please login again.');
        setLoading(false);
        return;
      }

      let userId = editingBorrower?.author; // Use existing user ID if editing

      // Only create new user if creating new borrower
      if (!isEditing) {
        const userData = {
          username: formData.email_address.split('@')[0], // Use email prefix as username
          email: formData.email_address,
          password: 'TempPassword123!', // Temporary password - should be changed by borrower
          first_name: formData.first_name,
          last_name: formData.last_name,
          roles: ['editor'] // Use editor role for borrowers
        };

        // Create WordPress user
        const userResponse = await fetch(`${process.env.REACT_APP_API_URL}/wp/v2/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(userData)
        });

        if (!userResponse.ok) {
          const userError = await userResponse.json();
          setError(`Failed to create user account: ${userError.message || 'Unknown error'}`);
          setLoading(false);
          return;
        }

        const newUser = await userResponse.json();
        userId = newUser.id;
      }

      // Handle file upload first - upload to media library
      let documentMediaId = null;
      if (formData.document_upload) {
        // New file uploaded
        try {
          const mediaFormData = new FormData();
          mediaFormData.append('file', formData.document_upload);
          mediaFormData.append('title', `Document for ${formData.first_name} ${formData.last_name}`);
          mediaFormData.append('description', `Document upload for borrower profile`);

          console.log('Uploading file to media library:', formData.document_upload.name);
          console.log('File size:', formData.document_upload.size);
          console.log('File type:', formData.document_upload.type);

          const mediaResponse = await fetch(`${process.env.REACT_APP_API_URL}/wp/v2/media`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            },
            body: mediaFormData
          });

          console.log('Media upload response status:', mediaResponse.status);
          console.log('Media upload response headers:', mediaResponse.headers);

          if (mediaResponse.ok) {
            const mediaData = await mediaResponse.json();
            documentMediaId = mediaData.id;
            console.log('Media uploaded successfully, ID:', documentMediaId);
            console.log('Media data:', mediaData);
          } else {
            const errorData = await mediaResponse.json();
            console.error('Failed to upload document:', errorData);
            console.error('Response status:', mediaResponse.status);
            console.error('Response statusText:', mediaResponse.statusText);
            setError(`Failed to upload document: ${errorData.message || errorData.code || 'Unknown error'}`);
            setLoading(false);
            return;
          }
        } catch (err) {
          console.error('Error uploading document:', err);
          setError(`Failed to upload document: ${err.message}`);
          setLoading(false);
          return;
        }
      } else if (isEditing && existingDocument) {
        // Keep existing document when editing
        documentMediaId = existingDocument;
      }

      // If we have a file but no media ID, the upload failed
      if (formData.document_upload && !documentMediaId) {
        setError('Document upload failed. Please try again.');
        setLoading(false);
        return;
      }

      // Prepare data for WordPress REST API - use JSON for PODs fields
      const borrowerData = {
        title: `${formData.first_name} ${formData.last_name}`,
        status: 'publish',
        author: userId,
        // General Fields - at root level for PODs
        first_name: formData.first_name,
        last_name: formData.last_name,
        email_address: formData.email_address,
        date_of_birth: formData.date_of_birth,
        mobile_number: formData.mobile_number,
        registration_number: formData.registration_number,
        home_address: formData.home_address,
        // Social Links
        social_link_1: formData.social_link_1,
        social_link_2: formData.social_link_2,
        // Employment Fields
        employment_status: formData.employment_status,
        work_rights: formData.work_rights,
        employer_name: formData.employer_name,
        job_title: formData.job_title,
        monthly_income_aud: formData.monthly_income_aud,
        employment_start_date: formData.employment_start_date,
        employer_phone: formData.employer_phone,
        employer_email: formData.employer_email,
        employer_address: formData.employer_address,
        // Family Fields
        marital_status: formData.marital_status,
        family_relationship: formData.family_relationship,
        family_member_full_name: formData.family_member_full_name,
        family_member_phone: formData.family_member_phone,
        family_member_email: formData.family_member_email,
        // Bank Fields
        bank_name: formData.bank_name,
        account_name: formData.account_name,
        bsb_number: formData.bsb_number,
        account_number: formData.account_number,
        // Personal Document Fields
        document_type: formData.document_type,
        document_upload: documentMediaId || null // Store the media ID directly, or null if upload failed
      };

      const url = isEditing 
        ? `${process.env.REACT_APP_API_URL}/wp/v2/borrower-profile/${editingBorrower.id}`
        : `${process.env.REACT_APP_API_URL}/wp/v2/borrower-profile`;
      
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(borrowerData)
      });

      const data = await response.json();
      console.log('Borrower profile response:', data);

      if (response.ok && data.id) {
        const documentInfo = documentMediaId ? ' Document uploaded successfully.' : '';
        const successMessage = isEditing 
          ? `Borrower profile updated successfully!${documentInfo}`
          : `Borrower profile created successfully! New user account created for ${formData.email_address} with temporary password: TempPassword123!${documentInfo}`;
        
        setSuccess(successMessage);
        
        // Store the created/updated borrower ID for future reference
        const profileWithId = { ...formData, id: data.id, userId: userId };
        localStorage.setItem('borrower_profile', JSON.stringify(profileWithId));
        
        // Call the callback to proceed to the next step
        if (onProfileComplete) {
          onProfileComplete(profileWithId);
        }
      } else {
        const errorMessage = isEditing 
          ? data.message || 'Failed to update borrower profile. Please try again.'
          : data.message || 'Failed to create borrower profile. Please try again.';
        setError(errorMessage);
      }
      
    } catch (err) {
      console.error('Error creating borrower profile:', err);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        
          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              <button
                type="button"
                onClick={() => setActiveTab('general')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'general'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                General Information
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('document')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'document'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Personal Document
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('employment')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'employment'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Employment
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('family')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'family'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Family Information
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('bank')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'bank'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Bank Details
              </button>
            </nav>
          </div>

          <form onSubmit={handleSubmit} className="p-6">
            {/* General Information Tab */}
            {activeTab === 'general' && (
              <div className="mb-8">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 mb-2">
                    First Name <span className="text-red-500">*</span>
                  </label>
                <input
                  type="text"
                  id="first_name"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleInputChange}
                  required
                  disabled={loading}
                    placeholder="Enter first name"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                />
              </div>
              
                <div>
                  <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                <input
                  type="text"
                  id="last_name"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleInputChange}
                  required
                  disabled={loading}
                    placeholder="Enter last name"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                />
              </div>
            </div>

              <div className="mt-6">
                <label htmlFor="email_address" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  id="email_address"
                  name="email_address"
                  value={formData.email_address}
                  onChange={handleInputChange}
                  required
                  disabled={loading}
                  placeholder="Enter borrower's email address"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                />
                <p className="text-sm text-gray-500 mt-2">
                Enter the borrower's email address. This will be used to create their WordPress user account and login credentials.
                </p>
            </div>

              <div className="mt-6">
                <label htmlFor="date_of_birth" className="block text-sm font-medium text-gray-700 mb-2">
                  Date of Birth
                </label>
              <input
                type="date"
                id="date_of_birth"
                name="date_of_birth"
                value={formData.date_of_birth}
                onChange={handleInputChange}
                disabled={loading}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div>
                  <label htmlFor="mobile_number" className="block text-sm font-medium text-gray-700 mb-2">
                    Mobile Number
                  </label>
              <input
                type="tel"
                id="mobile_number"
                name="mobile_number"
                value={formData.mobile_number}
                onChange={handleInputChange}
                disabled={loading}
                    placeholder="Enter mobile number"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
              />
            </div>

                <div>
                  <label htmlFor="registration_number" className="block text-sm font-medium text-gray-700 mb-2">
                    Registration Number
                  </label>
              <input
                type="text"
                id="registration_number"
                name="registration_number"
                value={formData.registration_number}
                onChange={handleInputChange}
                disabled={loading}
                    placeholder="Enter registration number"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
              />
                </div>
            </div>

              <div className="mt-6">
                <label htmlFor="home_address" className="block text-sm font-medium text-gray-700 mb-2">
                  Home Address
                </label>
              <textarea
                id="home_address"
                name="home_address"
                value={formData.home_address}
                onChange={handleInputChange}
                disabled={loading}
                  placeholder="Enter home address"
                rows="3"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div>
                  <label htmlFor="social_link_1" className="block text-sm font-medium text-gray-700 mb-2">
                    Social Link 1
                  </label>
                  <input
                    type="url"
                    id="social_link_1"
                    name="social_link_1"
                    value={formData.social_link_1}
                    onChange={handleInputChange}
                    disabled={loading}
                    placeholder="https://example.com"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                  />
                </div>

                <div>
                  <label htmlFor="social_link_2" className="block text-sm font-medium text-gray-700 mb-2">
                    Social Link 2
                  </label>
                  <input
                    type="url"
                    id="social_link_2"
                    name="social_link_2"
                    value={formData.social_link_2}
                    onChange={handleInputChange}
                    disabled={loading}
                    placeholder="https://example.com"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
              />
            </div>
          </div>
              </div>
            )}

            {/* Personal Document Tab */}
            {activeTab === 'document' && (
              <div className="mb-8">
              
              <div>
                <label htmlFor="document_type" className="block text-sm font-medium text-gray-700 mb-2">
                  Document Type
                </label>
              <select
                id="document_type"
                name="document_type"
                value={formData.document_type}
                onChange={handleInputChange}
                disabled={loading}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                >
                <option value="">Select document type</option>
                <option value="Passport">Passport</option>
                <option value="National ID">National ID</option>
                <option value="Driver License (AUD)">Driver License (AUD)</option>
              </select>
            </div>

            {formData.document_type && (
                <div className="mt-6">
                  <label htmlFor="document_upload" className="block text-sm font-medium text-gray-700 mb-2">
                    Document Upload
                </label>
                
                {/* Show existing document if editing */}
                {isEditing && existingDocument && (
                    <div className="mb-4 p-4 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center">
                        <div className="p-2 bg-green-100 rounded-lg mr-3">
                          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 mb-1">Current Document:</p>
                    <p className="text-sm text-gray-600">
                      {existingMediaDetails?.title?.rendered || existingMediaDetails?.post_title || `Document uploaded (ID: ${existingDocument})`}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {existingMediaDetails?.mime_type || existingMediaDetails?.post_mime_type || 'File uploaded to media library'}
                    </p>
                    {existingMediaDetails?.source_url && (
                      <a 
                        href={existingMediaDetails.source_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                              className="inline-flex items-center text-xs text-blue-600 hover:text-blue-800 underline mt-2 font-medium"
                      >
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                        View Current Document
                      </a>
                    )}
                        </div>
                      </div>
                  </div>
                )}
                
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                <input
                  type="file"
                  id="document_upload"
                  name="document_upload"
                  onChange={handleInputChange}
                  disabled={loading}
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      className="hidden"
                    />
                    <label htmlFor="document_upload" className="cursor-pointer">
                      <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="text-sm text-gray-600 mb-2">
                        <span className="font-medium text-blue-600 hover:text-blue-500">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-gray-500">
                  {isEditing 
                          ? 'Leave empty to keep current document, or upload a new one to replace it'
                          : 'PDF, JPG, PNG, DOC, DOCX (MAX. 5MB)'
                        }
                      </p>
                    </label>
                  </div>
                </div>
              )}
              </div>
            )}

            {/* Employment Tab */}
            {activeTab === 'employment' && (
              <div className="mb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="employment_status" className="block text-sm font-medium text-gray-700 mb-2">
                      Employment Status
                    </label>
                    <select
                      id="employment_status"
                      name="employment_status"
                      value={formData.employment_status}
                      onChange={handleInputChange}
                      disabled={loading}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                    >
                      <option value="">Select employment status</option>
                      <option value="Employed (Full-Time)">Employed (Full-Time)</option>
                      <option value="Employed (Part-Time)">Employed (Part-Time)</option>
                      <option value="Self-Employed">Self-Employed</option>
                      <option value="Unemployed">Unemployed</option>
                      <option value="Student">Student</option>
                      <option value="Retired">Retired</option>
                      <option value="Contract / Temporary">Contract / Temporary</option>
                      <option value="Casual / On-Call">Casual / On-Call</option>
                      <option value="Homemaker / Carer">Homemaker / Carer</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="work_rights" className="block text-sm font-medium text-gray-700 mb-2">
                      Work Rights
                    </label>
                    <select
                      id="work_rights"
                      name="work_rights"
                      value={formData.work_rights}
                      onChange={handleInputChange}
                      disabled={loading}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                    >
                      <option value="">Select work rights</option>
                      <option value="Full-time Work Rights">Full-time Work Rights</option>
                      <option value="Part-time Work Rights">Part-time Work Rights</option>
                      <option value="Casual Work Rights">Casual Work Rights</option>
                      <option value="Limited Work Rights (20 hrs/week)">Limited Work Rights (20 hrs/week)</option>
                      <option value="Restricted Student Visa Work Rights">Restricted Student Visa Work Rights</option>
                      <option value="Working Holiday Visa (6-month limit per employer)">Working Holiday Visa (6-month limit per employer)</option>
                      <option value="No Work Rights">No Work Rights</option>
                      <option value="Awaiting Visa Approval (Bridging)">Awaiting Visa Approval (Bridging)</option>
                      <option value="Permanent Full Work Rights">Permanent Full Work Rights</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="employer_name" className="block text-sm font-medium text-gray-700 mb-2">
                      Employer Name
                    </label>
                    <input
                      type="text"
                      id="employer_name"
                      name="employer_name"
                      value={formData.employer_name}
                      onChange={handleInputChange}
                      disabled={loading}
                      placeholder="Enter employer name"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                    />
                  </div>

                  <div>
                    <label htmlFor="job_title" className="block text-sm font-medium text-gray-700 mb-2">
                      Job Title
                    </label>
                    <input
                      type="text"
                      id="job_title"
                      name="job_title"
                      value={formData.job_title}
                      onChange={handleInputChange}
                      disabled={loading}
                      placeholder="Enter job title"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                    />
                  </div>

                  <div>
                    <label htmlFor="monthly_income_aud" className="block text-sm font-medium text-gray-700 mb-2">
                      Monthly Income (AUD)
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">$</span>
                      </div>
                      <input
                        type="number"
                        id="monthly_income_aud"
                        name="monthly_income_aud"
                        value={formData.monthly_income_aud}
                        onChange={handleInputChange}
                        disabled={loading}
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="employment_start_date" className="block text-sm font-medium text-gray-700 mb-2">
                      Employment Start Date
                    </label>
                    <input
                      type="date"
                      id="employment_start_date"
                      name="employment_start_date"
                      value={formData.employment_start_date}
                      onChange={handleInputChange}
                      disabled={loading}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                    />
                  </div>

                  <div>
                    <label htmlFor="employer_phone" className="block text-sm font-medium text-gray-700 mb-2">
                      Employer Phone
                    </label>
                    <input
                      type="tel"
                      id="employer_phone"
                      name="employer_phone"
                      value={formData.employer_phone}
                      onChange={handleInputChange}
                      disabled={loading}
                      placeholder="Enter employer phone number"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                    />
                  </div>

                  <div>
                    <label htmlFor="employer_email" className="block text-sm font-medium text-gray-700 mb-2">
                      Employer Email
                    </label>
                    <input
                      type="email"
                      id="employer_email"
                      name="employer_email"
                      value={formData.employer_email}
                      onChange={handleInputChange}
                      disabled={loading}
                      placeholder="Enter employer email"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                    />
                  </div>
                </div>

                <div className="mt-6">
                  <label htmlFor="employer_address" className="block text-sm font-medium text-gray-700 mb-2">
                    Employer Address
                  </label>
                  <textarea
                    id="employer_address"
                    name="employer_address"
                    value={formData.employer_address}
                    onChange={handleInputChange}
                    disabled={loading}
                    rows={3}
                    placeholder="Enter employer address"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                  />
                </div>
              </div>
            )}

            {/* Family Information Tab */}
            {activeTab === 'family' && (
              <div className="mb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="marital_status" className="block text-sm font-medium text-gray-700 mb-2">
                      Marital Status
                    </label>
                    <select
                      id="marital_status"
                      name="marital_status"
                      value={formData.marital_status}
                      onChange={handleInputChange}
                      disabled={loading}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                    >
                      <option value="">Select marital status</option>
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                      <option value="De Facto Relationship">De Facto Relationship</option>
                      <option value="Separated">Separated</option>
                      <option value="Divorced">Divorced</option>
                      <option value="Widowed">Widowed</option>
                      <option value="Engaged">Engaged</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="family_relationship" className="block text-sm font-medium text-gray-700 mb-2">
                      Family Relationship
                    </label>
                    <select
                      id="family_relationship"
                      name="family_relationship"
                      value={formData.family_relationship}
                      onChange={handleInputChange}
                      disabled={loading}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                    >
                      <option value="">Select family relationship</option>
                      <option value="Father">Father</option>
                      <option value="Mother">Mother</option>
                      <option value="Husband">Husband</option>
                      <option value="Wife">Wife</option>
                      <option value="Son">Son</option>
                      <option value="Daughter">Daughter</option>
                      <option value="Brother">Brother</option>
                      <option value="Sister">Sister</option>
                      <option value="Grandfather">Grandfather</option>
                      <option value="Grandmother">Grandmother</option>
                      <option value="Grandson">Grandson</option>
                      <option value="Granddaughter">Granddaughter</option>
                      <option value="Uncle">Uncle</option>
                      <option value="Aunt">Aunt</option>
                      <option value="Cousin">Cousin</option>
                      <option value="Nephew">Nephew</option>
                      <option value="Niece">Niece</option>
                      <option value="Partner">Partner</option>
                      <option value="Fiancé / Fiancée">Fiancé / Fiancée</option>
                      <option value="De Facto Partner">De Facto Partner</option>
                      <option value="Guardian">Guardian</option>
                      <option value="Child">Child</option>
                      <option value="Parent">Parent</option>
                      <option value="Relative">Relative</option>
                      <option value="Friend">Friend</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="family_member_full_name" className="block text-sm font-medium text-gray-700 mb-2">
                      Family Member Full Name
                    </label>
                    <input
                      type="text"
                      id="family_member_full_name"
                      name="family_member_full_name"
                      value={formData.family_member_full_name}
                      onChange={handleInputChange}
                      disabled={loading}
                      placeholder="Enter family member's full name"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                    />
                  </div>

                  <div>
                    <label htmlFor="family_member_phone" className="block text-sm font-medium text-gray-700 mb-2">
                      Family Member Phone
                    </label>
                    <input
                      type="tel"
                      id="family_member_phone"
                      name="family_member_phone"
                      value={formData.family_member_phone}
                      onChange={handleInputChange}
                      disabled={loading}
                      placeholder="Enter family member's phone number"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                    />
                  </div>
          </div>

                <div className="mt-6">
                  <label htmlFor="family_member_email" className="block text-sm font-medium text-gray-700 mb-2">
                    Family Member Email
                  </label>
                  <input
                    type="email"
                    id="family_member_email"
                    name="family_member_email"
                    value={formData.family_member_email}
                    onChange={handleInputChange}
                    disabled={loading}
                    placeholder="Enter family member's email address"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                  />
                </div>
              </div>
            )}

            {/* Bank Details Tab */}
            {activeTab === 'bank' && (
              <div className="mb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="bank_name" className="block text-sm font-medium text-gray-700 mb-2">
                      Bank Name
                    </label>
                    <select
                      id="bank_name"
                      name="bank_name"
                      value={formData.bank_name}
                      onChange={handleInputChange}
                      disabled={loading}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                    >
                      <option value="">Select bank</option>
                      <option value="ANZ (Australia and New Zealand Banking Group)">ANZ (Australia and New Zealand Banking Group)</option>
                      <option value="Commonwealth Bank of Australia (CBA)">Commonwealth Bank of Australia (CBA)</option>
                      <option value="Westpac Banking Corporation">Westpac Banking Corporation</option>
                      <option value="National Australia Bank (NAB)">National Australia Bank (NAB)</option>
                      <option value="Macquarie Bank">Macquarie Bank</option>
                      <option value="AMP Bank">AMP Bank</option>
                      <option value="Bank of Queensland (BOQ)">Bank of Queensland (BOQ)</option>
                      <option value="Bendigo Bank">Bendigo Bank</option>
                      <option value="Suncorp Bank">Suncorp Bank</option>
                      <option value="ING Bank (Australia)">ING Bank (Australia)</option>
                      <option value="HSBC Bank Australia">HSBC Bank Australia</option>
                      <option value="Citibank Australia">Citibank Australia</option>
                      <option value="Bankwest">Bankwest</option>
                      <option value="ME Bank (Members Equity Bank)">ME Bank (Members Equity Bank)</option>
                      <option value="UBank">UBank</option>
                      <option value="Virgin Money Australia">Virgin Money Australia</option>
                      <option value="Bank Australia">Bank Australia</option>
                      <option value="Heritage Bank">Heritage Bank</option>
                      <option value="Greater Bank">Greater Bank</option>
                      <option value="Newcastle Permanent">Newcastle Permanent</option>
                      <option value="People's Choice Credit Union">People's Choice Credit Union</option>
                      <option value="Beyond Bank Australia">Beyond Bank Australia</option>
                      <option value="Defence Bank">Defence Bank</option>
                      <option value="P&N Bank">P&N Bank</option>
                      <option value="Hume Bank">Hume Bank</option>
                      <option value="Teachers Mutual Bank">Teachers Mutual Bank</option>
                      <option value="Australian Military Bank">Australian Military Bank</option>
                      <option value="Police Bank">Police Bank</option>
                      <option value="Australian Unity Bank">Australian Unity Bank</option>
                      <option value="Bank of Sydney">Bank of Sydney</option>
                      <option value="BankSA">BankSA</option>
                      <option value="Bank of Melbourne">Bank of Melbourne</option>
                      <option value="RACQ Bank">RACQ Bank</option>
                      <option value="Gateway Bank">Gateway Bank</option>
                      <option value="Judo Bank">Judo Bank</option>
                      <option value="Volt Bank">Volt Bank</option>
                      <option value="Up Bank">Up Bank</option>
                      <option value="Alex Bank">Alex Bank</option>
                      <option value="86400 Bank">86400 Bank</option>
                      <option value="Revolut Australia">Revolut Australia</option>
                      <option value="Wise (formerly TransferWise)">Wise (formerly TransferWise)</option>
                      <option value="PayID / Osko (NPP)">PayID / Osko (NPP)</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="account_name" className="block text-sm font-medium text-gray-700 mb-2">
                      Account Name
                    </label>
                    <input
                      type="text"
                      id="account_name"
                      name="account_name"
                      value={formData.account_name}
                      onChange={handleInputChange}
                      disabled={loading}
                      placeholder="Enter account holder name"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                    />
                  </div>

                  <div>
                    <label htmlFor="bsb_number" className="block text-sm font-medium text-gray-700 mb-2">
                      BSB Number
                    </label>
                    <input
                      type="text"
                      id="bsb_number"
                      name="bsb_number"
                      value={formData.bsb_number}
                      onChange={handleInputChange}
                      disabled={loading}
                      placeholder="000000"
                      maxLength="6"
                      pattern="[0-9]{6}"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                    />
                  </div>

                  <div>
                    <label htmlFor="account_number" className="block text-sm font-medium text-gray-700 mb-2">
                      Account Number
                    </label>
                    <input
                      type="text"
                      id="account_number"
                      name="account_number"
                      value={formData.account_number}
                      onChange={handleInputChange}
                      disabled={loading}
                      placeholder="Enter account number"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                    />
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-2 mb-6">
                <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}
            
            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center space-x-2 mb-6">
                <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-green-700 text-sm">{success}</p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-200">
              <button 
                type="submit" 
                disabled={loading} 
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {loading && (
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                <span>
              {loading 
                ? (isEditing ? 'Updating Profile...' : 'Creating Profile...') 
                : (isEditing ? 'Update Borrower Profile' : 'Create Borrower Profile')
              }
                </span>
              </button>
              <button 
                type="button" 
                onClick={onCancel} 
                className="w-full sm:w-auto bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium"
              >
                Cancel
            </button>
          </div>
        </form>
    </div>
  );
};

export default BorrowerProfile;
