import React, { useState, useEffect } from 'react';
import { getVerificationStatus } from './utils/verification';
import MissingFieldsModal from './components/MissingFieldsModal';
import DocumentViewer from './components/DocumentViewer';
import { getAvatarByBorrowerId } from './utils/avatars';

const BorrowerDetail = ({ borrower, onBack, onEdit }) => {
  const [mediaDetails, setMediaDetails] = useState(null);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [showMissingFieldsModal, setShowMissingFieldsModal] = useState(false);
  const [showDocumentViewer, setShowDocumentViewer] = useState(false);
  const [activeLoans, setActiveLoans] = useState([]);
  const [loadingActiveLoans, setLoadingActiveLoans] = useState(false);

  // Fetch media details if document_upload is a media ID
  useEffect(() => {
    const fetchMediaDetails = async () => {
      // Check both document_upload field and meta.document_upload
      const documentUpload = borrower?.document_upload || borrower?.meta?.document_upload;
      
      console.log('Borrower document data:', {
        document_upload: borrower?.document_upload,
        meta_document_upload: borrower?.meta?.document_upload,
        resolved_document_upload: documentUpload,
        full_borrower_data: borrower
      });
      
      if (documentUpload) {
        
        if (typeof documentUpload === 'number' || 
            (typeof documentUpload === 'string' && !isNaN(documentUpload))) {
          // It's a media ID (number or string number)
          const mediaId = parseInt(documentUpload);
          setLoadingMedia(true);
          try {
            const token = localStorage.getItem('jwt_token');
            const response = await fetch(`${process.env.REACT_APP_API_URL}/wp/v2/media/${mediaId}`, {
              headers: {
                'Authorization': `Bearer ${token}`
              },
              mode: 'cors'
            });
            
            if (response.ok) {
              const media = await response.json();
              setMediaDetails(media);
            } else {
              console.error('Failed to fetch media details:', response.status);
            }
          } catch (err) {
            console.error('Error fetching media details:', err);
          } finally {
            setLoadingMedia(false);
          }
        } else if (typeof documentUpload === 'object' && documentUpload.id) {
          // If it's already a media object with an ID
          setMediaDetails(documentUpload);
        } else if (typeof documentUpload === 'object' && documentUpload.name) {
          // If it's a File object, we can't display it properly
          console.error('Document upload is a File object, not a media ID');
          setMediaDetails(null);
        }
      }
    };

    fetchMediaDetails();
  }, [borrower?.document_upload, borrower?.meta?.document_upload]);

  // Load Active Loans from relationship/meta field on borrower (field group: active_loan)
  useEffect(() => {
    const loadLoans = async () => {
      try {
        setLoadingActiveLoans(true);
        const raw = borrower?.active_loan || borrower?.meta?.active_loan || borrower?.fields?.active_loan || [];
        let ids = [];
        if (Array.isArray(raw)) {
          ids = raw.map(v => (typeof v === 'object' && v?.ID) ? String(v.ID) : String(v)).filter(Boolean);
        } else if (typeof raw === 'string') {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) ids = parsed.map(String);
          } catch (_) {
            ids = raw.split(',').map(s => s.trim()).filter(Boolean);
          }
        } else if (raw) {
          ids = [String(raw)];
        }
        if (!ids.length) { setActiveLoans([]); return; }
        const token = localStorage.getItem('jwt_token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const fetched = [];
        for (const id of ids) {
          try {
            const resp = await fetch(`${process.env.REACT_APP_API_URL}/wp/v2/loans/${id}?context=edit`, { headers, mode: 'cors' });
            if (resp.ok) fetched.push(await resp.json());
          } catch (_) {}
        }
        setActiveLoans(fetched);
      } finally {
        setLoadingActiveLoans(false);
      }
    };
    loadLoans();
  }, [borrower?.active_loan, borrower?.meta?.active_loan]);


  if (!borrower) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-md w-full">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Borrower Selected</h3>
            <p className="text-gray-500">Please select a borrower to view their details.</p>
          </div>
        </div>
      </div>
    );
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Not provided';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Get verification status using shared utility
  const verificationStatus = getVerificationStatus(borrower);
  const fullName = borrower.title?.rendered || `${borrower.first_name || ''} ${borrower.last_name || ''}`.trim() || 'Unknown Borrower';
  const initials = fullName.split(' ').map(n => n[0]).join('').toUpperCase();

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center">
            <button
              onClick={onBack}
              className="mr-4 p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex items-center">
              <img
                src={getAvatarByBorrowerId(borrower.id)}
                alt={fullName}
                className="w-16 h-16 rounded-full object-cover mr-4"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
              <div 
                className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl mr-4 hidden"
              >
                {initials}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">
                  {fullName}
                </h1>
                <div className="flex items-center gap-4">
                  <p className="text-gray-600">ID: {borrower.id}</p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    verificationStatus.color === 'green' 
                      ? 'bg-green-100 text-green-800' 
                      : verificationStatus.color === 'blue'
                      ? 'bg-blue-100 text-blue-800'
                      : verificationStatus.color === 'red'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {verificationStatus.status}
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {Math.round(verificationStatus.percentage)}% Complete
                  </span>
                  {verificationStatus.missingFields.length > 0 && (
                    <button
                      onClick={() => setShowMissingFieldsModal(true)}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 hover:bg-yellow-200 transition-colors"
                    >
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      {verificationStatus.missingFields.length} missing
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => onEdit(borrower)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span>Edit Profile</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
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
            <button
              type="button"
              onClick={() => setActiveTab('active_loans')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'active_loans'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Active Loans
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content with Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* General Information Tab */}
        {activeTab === 'general' && (
          <div className="p-6">
            <div className="space-y-8">
              {/* Personal Details Section */}
              <div>
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-xl mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Personal Details
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                    <div className="p-3 bg-gray-50 rounded-lg border">
                      <span className="text-gray-900">{borrower.first_name || borrower.title?.rendered?.split(' ')[0] || 'Not specified'}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                    <div className="p-3 bg-gray-50 rounded-lg border">
                      <span className="text-gray-900">{borrower.last_name || borrower.title?.rendered?.split(' ').slice(1).join(' ') || 'Not specified'}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth</label>
                    <div className="p-3 bg-gray-50 rounded-lg border">
                      <span className="text-gray-900">{borrower.date_of_birth ? formatDate(borrower.date_of_birth) : 'Not specified'}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Registration Number</label>
                    <div className="p-3 bg-gray-50 rounded-lg border">
                      <span className="text-gray-900">{borrower.registration_number || 'Not specified'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Information Section */}
              <div>
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-xl mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Contact Information
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                    <div className="p-3 bg-gray-50 rounded-lg border">
                      <span className="text-gray-900">{borrower.email_address || 'Not specified'}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Mobile Number</label>
                    <div className="p-3 bg-gray-50 rounded-lg border">
                      <span className="text-gray-900">{borrower.mobile_number || 'Not specified'}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Home Address</label>
                  <div className="p-3 bg-gray-50 rounded-lg border">
                    <span className="text-gray-900 whitespace-pre-line">{borrower.home_address || 'Not specified'}</span>
                  </div>
                </div>
              </div>

              {/* Social Links Section */}
              <div>
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-xl mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    Social Links
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Social Link 1</label>
                    <div className="p-3 bg-gray-50 rounded-lg border">
                      <span className="text-gray-900">
                        {borrower.social_link_1 ? (
                          <a href={borrower.social_link_1} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">
                            {borrower.social_link_1}
                          </a>
                        ) : 'Not specified'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Social Link 2</label>
                    <div className="p-3 bg-gray-50 rounded-lg border">
                      <span className="text-gray-900">
                        {borrower.social_link_2 ? (
                          <a href={borrower.social_link_2} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">
                            {borrower.social_link_2}
                          </a>
                        ) : 'Not specified'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Visa Status Tab */}
        {activeTab === 'visa' && (
          <div className="p-6">
            <div className="space-y-8">
              {/* Visa Status Section */}
              <div>
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-xl mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Visa Status
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Visa Type
                    </label>
                    <div className="p-3 bg-gray-50 rounded-lg border">
                      <span className="text-gray-900">
                        {borrower.visa_type || 'Not specified'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Visa Expiry Date
                    </label>
                    <div className="p-3 bg-gray-50 rounded-lg border">
                      <span className="text-gray-900">
                        {borrower.visa_expiry_date ? new Date(borrower.visa_expiry_date).toLocaleDateString() : 'Not specified'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Personal Document Tab */}
        {activeTab === 'document' && (
          <div className="p-6">
            <div className="space-y-8">
              {/* Personal Document Section */}
              <div>
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-xl mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Personal Document
                  </h3>
                </div>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Document Type</label>
                <div className="p-3 bg-gray-50 rounded-lg border">
                  <span className="text-gray-900">{Array.isArray(borrower.document_type) ? borrower.document_type.join(', ') : borrower.document_type || 'Not specified'}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Document Number</label>
                <div className="p-3 bg-gray-50 rounded-lg border">
                  <span className="text-gray-900">{borrower.document_number || borrower.meta?.document_number || 'Not specified'}</span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Document Upload</label>
                {loadingMedia ? (
                  <div className="flex items-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-200 border-t-blue-600 mr-3"></div>
                    <p className="text-sm text-blue-700 font-medium">Loading document details...</p>
                  </div>
                ) : (borrower.document_upload || borrower.meta?.document_upload) && borrower.document_upload !== false && borrower.document_upload !== '' ? (
                  <div className="flex items-center p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="p-2 bg-green-100 rounded-lg mr-4">
                      <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      {typeof borrower.document_upload === 'object' && borrower.document_upload.name ? (
                        // File object case - show error message
                        <div>
                          <p className="text-sm font-medium text-red-700">
                            Document upload error
                          </p>
                          <p className="text-xs text-gray-500">
                            Document was uploaded but not properly saved. File: {borrower.document_upload.name}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Please try uploading the document again.
                          </p>
                        </div>
                      ) : (
                        // Media ID case - show proper details
                        <div>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {mediaDetails?.title?.rendered || mediaDetails?.post_title || 'Document uploaded'}
                              </p>
                              <p className="text-xs text-gray-500">
                                {mediaDetails?.mime_type || mediaDetails?.post_mime_type || 'File uploaded to media library'}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                console.log('Eye button clicked, mediaDetails:', mediaDetails);
                                console.log('Borrower data:', borrower);
                                console.log('Borrower document_upload:', borrower?.document_upload);
                                console.log('Document upload type:', typeof borrower?.document_upload);
                                setShowDocumentViewer(true);
                              }}
                              className="ml-4 p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                              title="View Document"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                          </div>
                          {mediaDetails?.source_url && (
                            <div className="mt-2 flex space-x-2">
                              <a 
                                href={mediaDetails.source_url} 
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
                                href={mediaDetails.source_url}
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
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="p-2 bg-gray-100 rounded-lg mr-4">
                      <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-sm text-gray-500 font-medium">No document uploaded</p>
                  </div>
                )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Employment Information Tab */}
        {activeTab === 'employment' && (
          <div className="p-6">
            <div className="space-y-8">
              {/* Employment Status Section */}
              <div>
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-xl mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2V6" />
                    </svg>
                    Employment Status
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Employment Status</label>
                    <div className="p-3 bg-gray-50 rounded-lg border">
                      <span className="text-gray-900">{borrower.employment_status || 'Not specified'}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Work Rights</label>
                    <div className="p-3 bg-gray-50 rounded-lg border">
                      <span className="text-gray-900">{borrower.work_rights || 'Not specified'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Job Details Section */}
              <div>
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-xl mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    Job Details
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Employer Name</label>
                    <div className="p-3 bg-gray-50 rounded-lg border">
                      <span className="text-gray-900">{borrower.employer_name || 'Not specified'}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Job Title</label>
                    <div className="p-3 bg-gray-50 rounded-lg border">
                      <span className="text-gray-900">{borrower.job_title || 'Not specified'}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Monthly Income (AUD)</label>
                    <div className="p-3 bg-gray-50 rounded-lg border">
                      <span className="text-gray-900">
                        {borrower.monthly_income_aud ? `$${borrower.monthly_income_aud}` : 'Not specified'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Employment Start Date</label>
                    <div className="p-3 bg-gray-50 rounded-lg border">
                      <span className="text-gray-900">
                        {borrower.employment_start_date ? formatDate(borrower.employment_start_date) : 'Not specified'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Employer Contact Section */}
              <div>
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-xl mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Employer Contact
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Employer Phone</label>
                    <div className="p-3 bg-gray-50 rounded-lg border">
                      <span className="text-gray-900">{borrower.employer_phone || 'Not specified'}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Employer Email</label>
                    <div className="p-3 bg-gray-50 rounded-lg border">
                      <span className="text-gray-900">
                        {borrower.employer_email ? (
                          <a href={`mailto:${borrower.employer_email}`} className="text-blue-600 hover:text-blue-800 underline">
                            {borrower.employer_email}
                          </a>
                        ) : 'Not specified'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Employer Address</label>
                  <div className="p-3 bg-gray-50 rounded-lg border">
                    <span className="text-gray-900 whitespace-pre-line">{borrower.employer_address || 'Not specified'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Family Information Tab */}
        {activeTab === 'family' && (
          <div className="p-6">
            <div className="space-y-8">
              {/* Family Status Section */}
              <div>
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-xl mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    Family Status
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Marital Status</label>
                    <div className="p-3 bg-gray-50 rounded-lg border">
                      <span className="text-gray-900">{borrower.marital_status || 'Not specified'}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Family Relationship</label>
                    <div className="p-3 bg-gray-50 rounded-lg border">
                      <span className="text-gray-900">{borrower.family_relationship || 'Not specified'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Family Member Details Section */}
              <div>
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-xl mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Family Member Details
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Family Member Full Name</label>
                    <div className="p-3 bg-gray-50 rounded-lg border">
                      <span className="text-gray-900">{borrower.family_member_full_name || 'Not specified'}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Family Member Phone</label>
                    <div className="p-3 bg-gray-50 rounded-lg border">
                      <span className="text-gray-900">{borrower.family_member_phone || 'Not specified'}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Family Member Email</label>
                  <div className="p-3 bg-gray-50 rounded-lg border">
                    <span className="text-gray-900">
                      {borrower.family_member_email ? (
                        <a href={`mailto:${borrower.family_member_email}`} className="text-blue-600 hover:text-blue-800 underline">
                          {borrower.family_member_email}
                        </a>
                      ) : 'Not specified'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bank Details Tab */}
        {activeTab === 'bank' && (
          <div className="p-6">
            <div className="space-y-8">
              {/* Account Details Section */}
              <div>
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-xl mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Account Details
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Bank Name</label>
                    <div className="p-3 bg-gray-50 rounded-lg border">
                      <span className="text-gray-900">{borrower.bank_name || 'Not specified'}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Account Name</label>
                    <div className="p-3 bg-gray-50 rounded-lg border">
                      <span className="text-gray-900">{borrower.account_name || 'Not specified'}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">BSB Number</label>
                    <div className="p-3 bg-gray-50 rounded-lg border">
                      <span className="text-gray-900">{borrower.bsb && String(borrower.bsb).trim() ? borrower.bsb : (borrower.bsb_number && String(borrower.bsb_number).trim() ? borrower.bsb_number : 'Not specified')}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Account Number</label>
                    <div className="p-3 bg-gray-50 rounded-lg border">
                      <span className="text-gray-900">{borrower.account_number && String(borrower.account_number).trim() ? borrower.account_number : 'Not specified'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Active Loans Tab */}
        {activeTab === 'active_loans' && (
          <div className="p-6">
            <div className="space-y-4">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-xl mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Active Loans
                </h3>
              </div>
              {loadingActiveLoans ? (
                <div className="text-sm text-gray-600">Loading loans…</div>
              ) : (activeLoans && activeLoans.length > 0) ? (
                <div className="overflow-x-auto border rounded-md">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-700">Loan ID</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700">Product</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-700">Amount</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700">Status</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700">Start</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {activeLoans.map(l => (
                        <tr key={l.id}>
                          <td className="px-3 py-2 font-mono">{l.loan_id || l.meta?.loan_id || l.title?.rendered || `#${l.id}`}</td>
                          <td className="px-3 py-2">{l.loan_product || l.meta?.loan_product_name || '-'}</td>
                          <td className="px-3 py-2 text-right">{l.loan_amount || l.meta?.loan_amount || '-'}</td>
                          <td className="px-3 py-2">{l.loan_status || l.meta?.loan_status || l.status || '-'}</td>
                          <td className="px-3 py-2">{l.start_date || l.meta?.start_date || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-sm text-gray-600">No related active loans.</div>
              )}
            </div>
          </div>
        )}
          </div>
        </div>

        {/* Additional Information Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 sticky top-8">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-xl">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Additional Information
          </h2>
        </div>
        <div className="px-6 py-6">
          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Verification Status</label>
              <div className="flex items-center space-x-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  verificationStatus.color === 'green' 
                    ? 'bg-green-100 text-green-800' 
                    : verificationStatus.color === 'blue'
                    ? 'bg-blue-100 text-blue-800'
                    : verificationStatus.color === 'red'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {verificationStatus.status}
                </span>
                <span className="text-xs text-gray-500">
                  {Math.round(verificationStatus.percentage)}%
                </span>
                {verificationStatus.missingFields.length > 0 && (
                  <button
                    onClick={() => setShowMissingFieldsModal(true)}
                    className="text-xs text-yellow-600 hover:text-yellow-800 underline"
                  >
                    View {verificationStatus.missingFields.length} missing fields
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Profile Created</label>
              <p className="text-gray-900 font-medium">{formatDate(borrower.date)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Last Modified</label>
              <p className="text-gray-900 font-medium">{formatDate(borrower.modified)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                {borrower.status || 'Active'}
              </span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Borrower ID</label>
              <p className="text-gray-900 font-medium">
                {borrower.borrower_id || borrower.meta?.borrower_id || `EV${borrower.id.toString().padStart(7, '0')}`}
              </p>
            </div>
          </div>
        </div>
          </div>
        </div>
      </div>

      {/* Missing Fields Modal */}
      <MissingFieldsModal
        isOpen={showMissingFieldsModal}
        onClose={() => setShowMissingFieldsModal(false)}
        missingFields={verificationStatus.missingFields}
        verificationStatus={verificationStatus}
      />

      {/* Document Viewer Modal */}
      <DocumentViewer
        isOpen={showDocumentViewer}
        onClose={() => setShowDocumentViewer(false)}
        documentData={mediaDetails || (borrower?.document_upload ? {
          ID: typeof borrower.document_upload === 'number' ? borrower.document_upload :
              typeof borrower.document_upload === 'string' ? borrower.document_upload :
              borrower.document_upload?.ID || borrower.document_upload?.id || borrower.document_upload
        } : null)}
      />
    </div>
  );
};

export default BorrowerDetail;