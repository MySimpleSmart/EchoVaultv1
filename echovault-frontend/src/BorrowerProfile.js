import React, { useState, useEffect } from 'react';
import './BorrowerProfile.css';
import ConfirmationModal from './components/ConfirmationModal';
import SuccessMessage from './components/SuccessMessage';
import DocumentViewer from './components/DocumentViewer';
import { getRandomAvatar } from './utils/avatars';

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
    document_number: '',
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
    account_number: '',
    // Visa Status Fields
    visa_type: '',
    visa_expiry_date: '',
    // Borrower ID
    borrower_id: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [existingDocument, setExistingDocument] = useState(null);
  const [existingMediaDetails, setExistingMediaDetails] = useState(null);
  const [activeTab, setActiveTab] = useState('general');
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showDocumentViewer, setShowDocumentViewer] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [documentUploaded, setDocumentUploaded] = useState(false);

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
        document_number: editingBorrower.document_number || '',
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
        account_number: editingBorrower.account_number || '',
        // Visa Status Fields
        visa_type: editingBorrower.visa_type || '',
        visa_expiry_date: editingBorrower.visa_expiry_date || '',
        // Borrower ID
        borrower_id: editingBorrower.borrower_id || ''
      });
      
      // Store existing document info for display
      if (editingBorrower.document_upload) {
        console.log('Setting existingDocument to:', editingBorrower.document_upload);
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


  // API base URL with fallback
  const apiBase = (typeof window !== 'undefined' && window.REACT_APP_API_URL) || process.env.REACT_APP_API_URL || `${window.location.origin}/wp-json`;

  const fetchMediaDetails = async (mediaId) => {
    try {
      const token = localStorage.getItem('jwt_token');
      const response = await fetch(`${apiBase}/wp/v2/media/${mediaId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        mode: 'cors'
      });
      
      if (response.ok) {
        const media = await response.json();
        setExistingMediaDetails(media);
      }
    } catch (err) {
      console.error('Error fetching media details:', err);
    }
  };

  const handleInputChange = async (e) => {
    const { name, value, type, files } = e.target;
    
    if (type === 'file' && name === 'document_upload' && files[0]) {
      // Upload file IMMEDIATELY when selected
      const file = files[0];
      
      // NO FILE VALIDATION - ACCEPT ALL FILES
      console.log('File selected:', {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size
      });
      
      // Store file TEMPORARILY - DON'T upload yet
      console.log('File stored temporarily:', file.name);
      
      // Store file temporarily in formData
      setFormData(prev => ({
        ...prev,
        [name]: file // Store the file object temporarily
      }));
      
      // Create a temporary preview object
      const tempFilePreview = {
        name: file.name,
        type: file.type,
        size: file.size,
        isTemporary: true,
        file: file // Store the actual file object
      };
      
      // Store temporary file preview
      setFormData(prev => ({
        ...prev,
        tempUploadedFile: tempFilePreview
      }));
      
      setDocumentUploaded(true);
      setSuccess('File selected! Click Update to upload and save to borrower profile.');
      setTimeout(() => setSuccess(''), 3000);
      setHasUnsavedChanges(true);
    } else {
      // Handle regular input changes
      setFormData(prev => ({
        ...prev,
        [name]: type === 'file' ? files[0] : value
      }));
      setHasUnsavedChanges(true);
    }

    // Don't check email automatically - let user type freely
  };

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      setShowUnsavedModal(true);
    } else {
      onCancel();
    }
  };

  const handleConfirmCancel = () => {
    setShowUnsavedModal(false);
    setHasUnsavedChanges(false);
    onCancel();
  };

  const showSuccess = (message) => {
    setSuccessMessage(message);
    setShowSuccessMessage(true);
    setHasUnsavedChanges(false);
  };

  const handleDeleteDocument = () => {
    setFormData(prev => ({
      ...prev,
      document_upload: null
    }));
    setExistingMediaDetails(null);
    setDocumentUploaded(false);
    setSuccess('');
    setError('');
    setHasUnsavedChanges(true);
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

      const response = await fetch(`${apiBase}/wp/v2/borrower-profile`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        mode: 'cors'
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
          const response = await fetch(`${apiBase}/wp/v2/borrower-profile`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            mode: 'cors'
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

    // Only validate document fields if a document is being uploaded
    if (formData.document_upload) {
      // If uploading a document, document type is required
      if (!formData.document_type) {
        setError('Please select a document type when uploading a document.');
        setLoading(false);
        return;
      }

      // NO FILE VALIDATION - ACCEPT ALL FILES
      console.log('File validation removed - accepting all file types');
    }

    // Document upload is optional for both new and existing borrowers
    // Users can save the profile and upload documents later

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
        // Generate unique username from email and name
        const generateUniqueUsername = async (email, firstName, lastName) => {
          const baseUsername = email.split('@')[0]
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '') // Remove special characters
            .substring(0, 20); // Limit length
          
          let username = baseUsername;
          let counter = 1;
          
          // Check if username exists and generate unique one
          while (true) {
            try {
              const checkResponse = await fetch(`${apiBase}/wp/v2/users?search=${username}`, {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                mode: 'cors'
              });
              
              if (checkResponse.ok) {
                const users = await checkResponse.json();
                const userExists = users.some(user => user.slug === username);
                
                if (!userExists) {
                  break; // Username is available
                }
              }
              
              // Username exists, try with counter
              username = `${baseUsername}${counter}`;
              counter++;
              
              // Prevent infinite loop
              if (counter > 999) {
                // Fallback to timestamp-based username
                username = `${baseUsername}${Date.now().toString().slice(-4)}`;
                break;
              }
            } catch (error) {
              console.error('Error checking username:', error);
              // Fallback to timestamp-based username
              username = `${baseUsername}${Date.now().toString().slice(-4)}`;
              break;
            }
          }
          
          return username;
        };

        const uniqueUsername = await generateUniqueUsername(
          formData.email_address, 
          formData.first_name, 
          formData.last_name
        );

        const userData = {
          username: uniqueUsername,
          email: formData.email_address,
          password: 'TempPassword123!', // Temporary password - should be changed by borrower
          first_name: formData.first_name,
          last_name: formData.last_name,
          roles: ['editor'] // Use editor role for borrowers
        };

        // Create WordPress user
        const userResponse = await fetch(`${apiBase}/wp/v2/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(userData),
          mode: 'cors'
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

      // Handle document upload - upload temporary file if exists
      let documentMediaId = null;
      
      // Check if we have a temporary file to upload
      if (formData.tempUploadedFile && formData.tempUploadedFile.isTemporary) {
        console.log('Uploading temporary file:', formData.tempUploadedFile.name);
        
        try {
          setUploadingDocument(true);
          setUploadProgress(0);
          
          const mediaFormData = new FormData();
          mediaFormData.append('file', formData.tempUploadedFile.file);
          mediaFormData.append('title', `Document for ${formData.first_name || 'Borrower'} ${formData.last_name || ''}`);
          mediaFormData.append('description', `Document upload for borrower profile`);

          // Simulate progress
          const progressInterval = setInterval(() => {
            setUploadProgress(prev => Math.min(prev + 10, 90));
          }, 200);

          const mediaResponse = await fetch(`${apiBase}/wp/v2/media`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            },
            body: mediaFormData,
            mode: 'cors'
          });

          clearInterval(progressInterval);
          setUploadProgress(100);

          if (mediaResponse.ok) {
            const mediaData = await mediaResponse.json();
            console.log('Document uploaded successfully:', mediaData);
            
            // Use the uploaded media ID
            documentMediaId = mediaData.id;
            
            // Update existing media details with new upload
            setExistingMediaDetails(mediaData);
            
            // Clear temporary file
            setFormData(prev => ({
              ...prev,
              tempUploadedFile: null,
              document_upload: mediaData.id
            }));
            
            setSuccess('Document uploaded and saved successfully!');
          } else {
            const errorData = await mediaResponse.json();
            throw new Error(errorData.message || 'Failed to upload document');
          }
        } catch (err) {
          console.error('Error uploading document:', err);
          setError(`Failed to upload document: ${err.message}`);
          setUploadingDocument(false);
          setUploadProgress(0);
          return;
        } finally {
          setUploadingDocument(false);
          setUploadProgress(0);
        }
      } else if (formData.newUploadedMedia) {
        // New file was uploaded - use it
        documentMediaId = formData.newUploadedMedia.id;
        
        // Replace current document with new uploaded one
        setExistingMediaDetails(formData.newUploadedMedia);
      } else if (formData.document_upload && typeof formData.document_upload === 'number') {
        // Existing media ID - use it
        documentMediaId = formData.document_upload;
      } else if (isEditing && existingDocument) {
        // Keep existing document when editing
        documentMediaId = existingDocument;
      }

      // Helper function to clean empty values - only send non-empty values
      const cleanValue = (value) => {
        if (value === null || value === undefined || value === '') {
          return null; // Don't send empty values to avoid API issues
        }
        return value;
      };

      // Generate unique borrower ID for new borrowers
      let borrowerId = formData.borrower_id;
      if (!isEditing && !borrowerId) {
        // Generate EV0000001 format
        try {
          const response = await fetch(`${apiBase}/wp/v2/borrower-profile?per_page=100&orderby=id&order=desc`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            mode: 'cors'
          });
          
          if (response.ok) {
            const borrowers = await response.json();
            // Find the highest borrower_id that follows the EV pattern
            let highestId = 0;
            borrowers.forEach(borrower => {
              if (borrower.borrower_id && borrower.borrower_id.startsWith('EV')) {
                const idNumber = parseInt(borrower.borrower_id.substring(2));
                if (!isNaN(idNumber) && idNumber > highestId) {
                  highestId = idNumber;
                }
              }
            });
            
            const nextId = highestId + 1;
            borrowerId = `EV${nextId.toString().padStart(7, '0')}`;
          } else {
            // Fallback if API call fails
            borrowerId = `EV${Date.now().toString().slice(-7)}`;
          }
        } catch (error) {
          console.error('Error generating borrower ID:', error);
          // Fallback if API call fails
          borrowerId = `EV${Date.now().toString().slice(-7)}`;
        }
      } else if (isEditing && !borrowerId) {
        // If editing and no borrower_id exists, generate one
        borrowerId = `EV${editingBorrower.id.toString().padStart(7, '0')}`;
      }

      // Prepare data for WordPress REST API - only include fields with values
      const borrowerData = {
        title: `${formData.first_name} ${formData.last_name}`,
        status: 'publish',
        author: userId,
        // Always include required fields
        first_name: formData.first_name,
        last_name: formData.last_name,
        email_address: formData.email_address,
        borrower_id: borrowerId
      };

      // Debug logging
      console.log('Generated Borrower ID:', borrowerId);
      console.log('Borrower Data being sent:', borrowerData);

      // Also add borrower_id, avatar, and document_upload as meta data to ensure they're saved
      borrowerData.meta = {
        borrower_id: borrowerId
      };
      
      // Assign random avatar for new borrowers, or keep existing avatar when editing
      let avatarToSave = null;
      if (!isEditing) {
        // Generate random avatar for new borrowers
        avatarToSave = getRandomAvatar();
        console.log('Generated random avatar for new borrower:', avatarToSave);
      } else if (editingBorrower) {
        // Preserve existing avatar when editing
        avatarToSave = editingBorrower.avatar || 
                       editingBorrower.meta?.avatar || 
                       editingBorrower.fields?.avatar ||
                       (Array.isArray(editingBorrower.avatar) ? editingBorrower.avatar[0] : null) ||
                       (Array.isArray(editingBorrower.meta?.avatar) ? editingBorrower.meta.avatar[0] : null);
        console.log('Preserving existing avatar for edit:', avatarToSave);
      }
      
      // Always set avatar (new, existing, or fallback)
      if (!avatarToSave) {
        // Fallback: generate one if somehow missing
        avatarToSave = getRandomAvatar();
        console.log('Using fallback avatar:', avatarToSave);
      }
      
      // Set avatar in both top-level and meta to ensure it's saved
      borrowerData.avatar = avatarToSave;
      borrowerData.meta.avatar = avatarToSave;
      console.log('Avatar being saved:', avatarToSave);
      
      // Add document upload to meta as well
      if (documentMediaId) {
        borrowerData.meta.document_upload = documentMediaId;
      }

      // Only include fields that have actual values - don't send empty fields
      const fieldsToCheck = [
        'date_of_birth', 'mobile_number', 'registration_number', 'home_address',
        'social_link_1', 'social_link_2',
        'employment_status', 'work_rights', 'employer_name', 'job_title', 
        'monthly_income_aud', 'employment_start_date', 'employer_phone', 
        'employer_email', 'employer_address',
        'marital_status', 'family_relationship', 'family_member_full_name', 
        'family_member_phone', 'family_member_email',
        'bank_name', 'account_name', 'bsb_number', 'account_number',
        'visa_type', 'visa_expiry_date', 'document_type', 'document_number'
      ];

      fieldsToCheck.forEach(field => {
        const value = formData[field];
        // Always include the field to ensure it gets updated (including empty values)
        if (value !== null && value !== undefined) {
          // Handle numeric fields
          if (field === 'monthly_income_aud') {
            borrowerData[field] = value === '' ? '' : (parseFloat(value) || 0);
          } else {
            // Send the actual value (including empty strings to clear fields)
            borrowerData[field] = value;
          }
        }
      });
      
      // Debug final borrower data - specifically check avatar
      console.log('Final borrower data before API call:', borrowerData);
      console.log('Avatar field in borrowerData:', borrowerData.avatar);
      console.log('Avatar in meta:', borrowerData.meta?.avatar);

      // Add document upload if available
      if (documentMediaId) {
        borrowerData.document_upload = documentMediaId;
        console.log('Document Media ID being sent:', documentMediaId);
      }

      const url = isEditing 
        ? `${apiBase}/wp/v2/borrower-profile/${editingBorrower.id}`
        : `${apiBase}/wp/v2/borrower-profile`;
      
      const method = isEditing ? 'PUT' : 'POST';
      

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(borrowerData),
        mode: 'cors'
      });

      const data = await response.json();

      // Debug logging for API response
      console.log('API Response:', data);
      console.log('Response Status:', response.status);
      console.log('Request Data Sent:', borrowerData);
      console.log('Avatar in API Response:', data.avatar || data.meta?.avatar || data.fields?.avatar);

      if (response.ok && data.id) {
        const successMessage = isEditing 
          ? `Borrower profile updated successfully!`
          : `Borrower profile created successfully! New user account created for ${formData.email_address}. A welcome email with password setup instructions has been sent.`;
        
        showSuccess(successMessage);
        
        // Store the created/updated borrower ID for future reference, including avatar from response
        const savedAvatar = data.avatar || data.meta?.avatar || data.fields?.avatar || borrowerData.avatar;
        const profileWithId = { ...formData, id: data.id, userId: userId, avatar: savedAvatar };
        console.log('Saved profile with avatar:', savedAvatar);
        localStorage.setItem('borrower_profile', JSON.stringify(profileWithId));
        
        // Call the callback to proceed to the next step
        if (onProfileComplete) {
          onProfileComplete(profileWithId);
        }
      } else {
        // More detailed error handling
        let errorMessage = '';
        if (data.message) {
          errorMessage = data.message;
        } else if (data.code) {
          errorMessage = `Error: ${data.code}`;
        } else if (response.status === 400) {
          errorMessage = 'Invalid data provided. Please check your input and try again.';
        } else if (response.status === 401) {
          errorMessage = 'Authentication failed. Please login again.';
        } else if (response.status === 403) {
          errorMessage = 'You do not have permission to perform this action.';
        } else if (response.status === 500) {
          errorMessage = 'Server error. Please try again later.';
        } else {
          errorMessage = isEditing 
            ? 'Failed to update borrower profile. Please try again.'
            : 'Failed to create borrower profile. Please try again.';
        }
        
        console.error('API Error Details:', {
          status: response.status,
          statusText: response.statusText,
          data: data,
          url: url,
          method: method
        });
        
        setError(errorMessage);
      }
      
    } catch (err) {
      console.error('Network/Fetch Error:', err);
      
      if (err.message.includes('CORS') || err.message.includes('Access-Control-Allow-Origin')) {
        setError('CORS error: Please check if the WordPress backend allows requests from this domain.');
      } else if (err.message.includes('Failed to fetch')) {
        setError('Network error: Unable to connect to the server. Please check your internet connection and try again.');
      } else if (err.name === 'TypeError' && err.message.includes('fetch')) {
        setError('Connection error: Unable to reach the server. Please check your internet connection.');
      } else {
        setError(`Unexpected error: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
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
                onClick={() => setActiveTab('visa')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'visa'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Visa Status
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
                  disabled={loading || isEditing}
                  placeholder="Enter borrower's email address"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                />
                <p className="text-sm text-gray-500 mt-2">
                  {isEditing 
                    ? "Email address cannot be changed after registration as it's linked to the user account."
                    : "Enter the borrower's email address. This will be used to create their WordPress user account and login credentials. Cannot be changed after registration."
                  }
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

            {/* Visa Status Tab */}
            {activeTab === 'visa' && (
              <div className="mb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="visa_type" className="block text-sm font-medium text-gray-700 mb-2">
                      Visa Type
                    </label>
                    <select
                      id="visa_type"
                      name="visa_type"
                      value={formData.visa_type}
                      onChange={handleInputChange}
                      disabled={loading}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                    >
                      <option value="">Select visa type</option>
                      <option value="Australian Citizen">Australian Citizen</option>
                      <option value="Permanent Resident">Permanent Resident</option>
                      <option value="Temporary Skill Shortage Visa (Subclass 482)">Temporary Skill Shortage Visa (Subclass 482)</option>
                      <option value="Skilled Independent Visa (Subclass 189)">Skilled Independent Visa (Subclass 189)</option>
                      <option value="Skilled Nominated Visa (Subclass 190)">Skilled Nominated Visa (Subclass 190)</option>
                      <option value="Skilled Work Regional (Provisional) Visa (Subclass 491)">Skilled Work Regional (Provisional) Visa (Subclass 491)</option>
                      <option value="Student Visa (Subclass 500)">Student Visa (Subclass 500)</option>
                      <option value="Graduate Visa (Subclass 485)">Graduate Visa (Subclass 485)</option>
                      <option value="Working Holiday Visa (Subclass 417)">Working Holiday Visa (Subclass 417)</option>
                      <option value="Work and Holiday Visa (Subclass 462)">Work and Holiday Visa (Subclass 462)</option>
                      <option value="Partner Visa (Subclass 820/801)">Partner Visa (Subclass 820/801)</option>
                      <option value="Bridging Visa A">Bridging Visa A</option>
                      <option value="Bridging Visa B">Bridging Visa B</option>
                      <option value="Bridging Visa C">Bridging Visa C</option>
                      <option value="Protection / Humanitarian Visa (Subclass 866)">Protection / Humanitarian Visa (Subclass 866)</option>
                      <option value="Refugee Visa (Subclass 200)">Refugee Visa (Subclass 200)</option>
                      <option value="Tourist Visa (Subclass 600)">Tourist Visa (Subclass 600)</option>
                      <option value="Visitor Visa (Subclass 651)">Visitor Visa (Subclass 651)</option>
                      <option value="Temporary Activity Visa (Subclass 408)">Temporary Activity Visa (Subclass 408)</option>
                      <option value="Business Innovation and Investment Visa (Subclass 188/888)">Business Innovation and Investment Visa (Subclass 188/888)</option>
                      <option value="Employer Nomination Scheme (Subclass 186)">Employer Nomination Scheme (Subclass 186)</option>
                      <option value="Regional Sponsored Migration Scheme (Subclass 187)">Regional Sponsored Migration Scheme (Subclass 187)</option>
                      <option value="Training Visa (Subclass 407)">Training Visa (Subclass 407)</option>
                      <option value="Temporary Graduate Visa (Subclass 485)">Temporary Graduate Visa (Subclass 485)</option>
                      <option value="Temporary Work (Short Stay Specialist) Visa (Subclass 400)">Temporary Work (Short Stay Specialist) Visa (Subclass 400)</option>
                      <option value="Working Holiday Maker (WHM) Extension Visa">Working Holiday Maker (WHM) Extension Visa</option>
                      <option value="Resident Return Visa (Subclass 155/157)">Resident Return Visa (Subclass 155/157)</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="visa_expiry_date" className="block text-sm font-medium text-gray-700 mb-2">
                      Visa Expiry Date
                    </label>
                    <input
                      type="date"
                      id="visa_expiry_date"
                      name="visa_expiry_date"
                      value={formData.visa_expiry_date}
                      onChange={handleInputChange}
                      disabled={loading}
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

            <div className="mt-6">
              <label htmlFor="document_number" className="block text-sm font-medium text-gray-700 mb-2">
                Document Number
              </label>
              <input
                type="text"
                id="document_number"
                name="document_number"
                value={formData.document_number}
                onChange={handleInputChange}
                disabled={loading}
                placeholder="Enter document number"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
              />
            </div>

            {formData.document_type && (
                <div className="mt-6">
                  <label htmlFor="document_upload" className="block text-sm font-medium text-gray-700 mb-2">
                    Document Upload
                </label>
                
                {/* Show existing document if editing */}
                {isEditing && existingDocument && (
                    <div className="mb-4 p-4 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center justify-between">
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
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            console.log('Eye button clicked in BorrowerProfile, existingMediaDetails:', existingMediaDetails);
                            setShowDocumentViewer(true);
                          }}
                          className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                          title="View Document"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                      </div>
                      {existingMediaDetails?.source_url && (
                        <div className="mt-2 flex space-x-2">
                          <a 
                            href={existingMediaDetails.source_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-xs text-blue-600 hover:text-blue-800 underline font-medium"
                          >
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            Open in New Tab
                          </a>
                          <a 
                            href={existingMediaDetails.source_url}
                            download
                            className="inline-flex items-center text-xs text-green-600 hover:text-green-800 underline font-medium"
                          >
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Download
                          </a>
                        </div>
                      )}
                  </div>
                )}

                {/* Upload Progress */}
                {uploadingDocument && (
                  <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center mb-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-200 border-t-blue-600 mr-2"></div>
                      <span className="text-sm font-medium text-blue-700">Uploading document...</span>
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-blue-600 mt-1">{uploadProgress}% complete</p>
                  </div>
                )}


                {/* Temporary File Display */}
                {formData.tempUploadedFile && formData.tempUploadedFile.isTemporary && (
                  <div className="mb-4 p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start">
                        <svg className="w-5 h-5 text-green-600 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <span className="text-sm font-medium text-green-700">File selected! Click Update to upload and save.</span>
                          <div className="mt-1 text-xs text-gray-600">
                            <p><strong>Name:</strong> {formData.tempUploadedFile.name}</p>
                            <p><strong>Type:</strong> {formData.tempUploadedFile.type}</p>
                            <p><strong>Size:</strong> {(formData.tempUploadedFile.size / 1024).toFixed(1)} KB</p>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, tempUploadedFile: null, document_upload: null }));
                          setSuccess('');
                        }}
                        className="p-1 text-red-600 hover:text-red-800 transition-colors"
                        title="Remove Selected File"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}

                {/* Upload Success with File Details */}
                {documentUploaded && existingMediaDetails && existingMediaDetails.isTemporary && (
                  <div className="mb-4 p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start">
                        <svg className="w-5 h-5 text-green-600 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <span className="text-sm font-medium text-green-700">File uploaded successfully! Click Update to save to borrower profile.</span>
                          <div className="mt-1 text-xs text-gray-600">
                            <p><strong>Name:</strong> {existingMediaDetails.title?.rendered || existingMediaDetails.post_title || 'Document'}</p>
                            <p><strong>Type:</strong> {existingMediaDetails.mime_type || 'Unknown'}</p>
                            <p><strong>Size:</strong> {existingMediaDetails.media_details?.filesize ? `${(existingMediaDetails.media_details.filesize / 1024).toFixed(1)} KB` : 'Unknown'}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          type="button"
                          onClick={() => setShowDocumentViewer(true)}
                          className="p-1 text-blue-600 hover:text-blue-800 transition-colors"
                          title="View Document"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={handleDeleteDocument}
                          className="p-1 text-red-600 hover:text-red-800 transition-colors"
                          title="Delete Document"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
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
                  accept=".pdf,.jpg,.jpeg,.png,.gif"
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
                onClick={handleCancel} 
                className="w-full sm:w-auto bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium"
              >
                Cancel
            </button>
          </div>
        </form>
      </div>

      {/* Confirmation Modal for Unsaved Changes */}
      <ConfirmationModal
        isOpen={showUnsavedModal}
        onClose={() => setShowUnsavedModal(false)}
        onConfirm={handleConfirmCancel}
        title="Unsaved Changes"
        message="You have unsaved changes. Are you sure you want to leave without saving?"
        confirmText="Leave Without Saving"
        cancelText="Continue Editing"
        type="warning"
      />

      {/* Success Message */}
      <SuccessMessage
        isVisible={showSuccessMessage}
        onClose={() => setShowSuccessMessage(false)}
        message={successMessage}
        type="success"
        autoClose={true}
        duration={5000}
      />

      {/* Document Viewer Modal */}
      <DocumentViewer
        isOpen={showDocumentViewer}
        onClose={() => setShowDocumentViewer(false)}
        documentData={existingMediaDetails}
      />
    </>
  );
};

export default BorrowerProfile;
