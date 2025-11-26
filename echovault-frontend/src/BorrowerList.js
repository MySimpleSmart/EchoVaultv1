import React, { useState, useEffect } from 'react';
import { getVerificationStatus, getVerificationStats } from './utils/verification';
import MissingFieldsModal from './components/MissingFieldsModal';
import { getAvatarByBorrowerId } from './utils/avatars';

const BorrowerList = ({ onSelectBorrower, onCreateNew }) => {
  const [borrowers, setBorrowers] = useState([]);
  const [filteredBorrowers, setFilteredBorrowers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showMissingFieldsModal, setShowMissingFieldsModal] = useState(false);
  const [selectedBorrowerForModal, setSelectedBorrowerForModal] = useState(null);
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [documentTypeFilter, setDocumentTypeFilter] = useState('all');
  
  // Pagination states
  const [perPage, setPerPage] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchBorrowers();
  }, []);

  // Filter and search effect
  useEffect(() => {
    filterBorrowers();
    setCurrentPage(1);
  }, [borrowers, searchTerm, statusFilter, documentTypeFilter]);

  // Get verification statistics for the dashboard
  const verificationStats = getVerificationStats(borrowers);

  // Filter and search function
  const filterBorrowers = () => {
    let filtered = [...borrowers];

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(borrower => {
        const fullName = borrower.first_name && borrower.last_name 
          ? `${borrower.first_name} ${borrower.last_name}`
          : borrower.title?.rendered || '';
        const email = borrower.email_address || '';
        const borrowerId = borrower.borrower_id || borrower.meta?.borrower_id || `EV${borrower.id.toString().padStart(7, '0')}`;
        
        return fullName.toLowerCase().includes(searchLower) ||
               email.toLowerCase().includes(searchLower) ||
               borrowerId.toLowerCase().includes(searchLower);
      });
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(borrower => {
        const verificationStatus = getVerificationStatus(borrower);
        return verificationStatus.status.toLowerCase() === statusFilter.toLowerCase();
      });
    }

    // Document type filter
    if (documentTypeFilter !== 'all') {
      filtered = filtered.filter(borrower => {
        const docType = borrower.document_type;
        if (!docType) return false;
        
        const docTypeArray = Array.isArray(docType) ? docType : [docType];
        return docTypeArray.some(type => 
          type.toLowerCase().includes(documentTypeFilter.toLowerCase())
        );
      });
    }

    setFilteredBorrowers(filtered);
  };

  // Get unique document types for filter dropdown
  const getUniqueDocumentTypes = () => {
    const types = new Set();
    borrowers.forEach(borrower => {
      if (borrower.document_type) {
        const docTypeArray = Array.isArray(borrower.document_type) ? borrower.document_type : [borrower.document_type];
        docTypeArray.forEach(type => types.add(type));
      }
    });
    return Array.from(types).sort();
  };

  // Get unique statuses for filter dropdown
  const getUniqueStatuses = () => {
    const statuses = new Set();
    borrowers.forEach(borrower => {
      const verificationStatus = getVerificationStatus(borrower);
      statuses.add(verificationStatus.status);
    });
    return Array.from(statuses).sort();
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setDocumentTypeFilter('all');
  };

  // Pagination derived data
  const totalItems = filteredBorrowers.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const startIdx = (currentPage - 1) * perPage;
  const endIdx = Math.min(startIdx + perPage, totalItems);
  const paginatedBorrowers = filteredBorrowers.slice(startIdx, endIdx);

  const goToPage = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  // API base URL with fallback
  const apiBase = (typeof window !== 'undefined' && window.REACT_APP_API_URL) || process.env.REACT_APP_API_URL || `${window.location.origin}/wp-json`;

  const fetchBorrowers = async () => {
    try {
      const token = localStorage.getItem('jwt_token');
      
      if (!token) {
        setError('Authentication token not found. Please login again.');
        setLoading(false);
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
        const data = await response.json();
        console.log('Borrowers API response:', data);
        setBorrowers(data);
      } else {
        setError('Failed to fetch borrowers. Please try again.');
      }
    } catch (err) {
      console.error('Error fetching borrowers:', err);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mx-auto mb-4"></div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading Borrowers</h3>
          <p className="text-gray-600">Please wait while we fetch the latest data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-sm p-8 max-w-md w-full border border-gray-200">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load Borrowers</h3>
            <p className="text-gray-600 mb-6">{error}</p>
            <button 
              onClick={fetchBorrowers}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Borrower List</h1>
              <p className="text-gray-600">Manage and view borrower profiles and loan information</p>
            </div>
            <button
              onClick={onCreateNew}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 self-start sm:self-center"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>Create New Profile</span>
            </button>
          </div>
        </div>

        {/* Search and Filter Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Search Input */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Borrowers
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search by name, email, or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Statuses</option>
                {getUniqueStatuses().map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            {/* Document Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Document Type
              </label>
              <select
                value={documentTypeFilter}
                onChange={(e) => setDocumentTypeFilter(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Document Types</option>
                {getUniqueDocumentTypes().map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            
          </div>

          {/* Filter Actions */}
          <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              Showing {startIdx + 1}-{endIdx} of {filteredBorrowers.length} borrowers
              {(searchTerm || statusFilter !== 'all' || documentTypeFilter !== 'all') && (
                <span className="ml-2 text-blue-600">
                  (filtered)
                </span>
              )}
            </div>
            {(searchTerm || statusFilter !== 'all' || documentTypeFilter !== 'all') && (
              <button
                onClick={clearFilters}
                className="text-sm text-gray-500 hover:text-gray-700 underline"
              >
                Clear all filters
              </button>
            )}
          </div>
        </div>

        {borrowers.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No borrowers found</h3>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">Get started by creating your first borrower profile. This will help you manage loan applications and track borrower information.</p>
            <button
              onClick={onCreateNew}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 mx-auto"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>Create First Profile</span>
            </button>
          </div>
        ) : filteredBorrowers.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No borrowers found</h3>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">
              No borrowers match your current search and filter criteria. Try adjusting your filters or search terms.
            </p>
            <button
              onClick={clearFilters}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 mx-auto"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Clear Filters</span>
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Borrower
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Document Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedBorrowers.map((borrower) => {
                    const fullName = borrower.first_name && borrower.last_name 
                      ? `${borrower.first_name} ${borrower.last_name}`
                      : borrower.title?.rendered || 'Unknown Borrower';
                    const initials = fullName.split(' ').map(n => n[0]).join('').toUpperCase();
                    const verificationStatus = getVerificationStatus(borrower);
                    
                    
                    return (
                      <tr 
                        key={borrower.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => onSelectBorrower(borrower)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <img
                              src={getAvatarByBorrowerId(borrower)}
                              alt={fullName}
                              className="w-10 h-10 rounded-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                            <div 
                              className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm hidden"
                            >
                              {initials}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{fullName}</div>
                              <div className="text-sm text-gray-500">
                                ID: {borrower.borrower_id || borrower.meta?.borrower_id || `EV${borrower.id.toString().padStart(7, '0')}`}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{borrower.email_address || '-'}</div>
                          <div className="text-sm text-gray-500">{borrower.mobile_number || '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {borrower.document_type 
                              ? (Array.isArray(borrower.document_type) ? borrower.document_type.join(', ') : borrower.document_type)
                              : '-'
                            }
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col space-y-1">
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
                              {Math.round(verificationStatus.percentage)}% Complete
                            </span>
                            {verificationStatus.missingFields.length > 0 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedBorrowerForModal(borrower);
                                  setShowMissingFieldsModal(true);
                                }}
                                className="text-xs text-yellow-600 hover:text-yellow-800 underline"
                              >
                                {verificationStatus.missingFields.length} missing
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(borrower.date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectBorrower(borrower);
                            }}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Pagination Controls */}
            <div className="px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white border-t border-gray-200">
              <div className="flex items-center gap-3 text-sm text-gray-700">
                <span>Rows per page:</span>
                <select
                  value={perPage}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setPerPage(val);
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 border border-gray-300 rounded"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span>
                  {totalItems === 0 ? '0' : (startIdx + 1)}-{endIdx} of {totalItems}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => goToPage(1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  « First
                </button>
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ‹ Prev
                </button>
                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next ›
                </button>
                <button
                  onClick={() => goToPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Last »
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Missing Fields Modal */}
        {selectedBorrowerForModal && (
          <MissingFieldsModal
            isOpen={showMissingFieldsModal}
            onClose={() => {
              setShowMissingFieldsModal(false);
              setSelectedBorrowerForModal(null);
            }}
            missingFields={getVerificationStatus(selectedBorrowerForModal).missingFields}
            verificationStatus={getVerificationStatus(selectedBorrowerForModal)}
          />
        )}
    </div>
  );
};

export default BorrowerList;
