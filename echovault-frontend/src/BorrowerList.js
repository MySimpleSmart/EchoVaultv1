import React, { useState, useEffect } from 'react';
import { getVerificationStatus, getVerificationStats } from './utils/verification';
import MissingFieldsModal from './components/MissingFieldsModal';
import { getAvatarByBorrowerId } from './utils/avatars';

const BorrowerList = ({ onSelectBorrower, onCreateNew }) => {
  const [borrowers, setBorrowers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showMissingFieldsModal, setShowMissingFieldsModal] = useState(false);
  const [selectedBorrowerForModal, setSelectedBorrowerForModal] = useState(null);

  useEffect(() => {
    fetchBorrowers();
  }, []);

  // Get verification statistics for the dashboard
  const verificationStats = getVerificationStats(borrowers);

  const fetchBorrowers = async () => {
    try {
      const token = localStorage.getItem('jwt_token');
      
      if (!token) {
        setError('Authentication token not found. Please login again.');
        setLoading(false);
        return;
      }

      const response = await fetch(`${process.env.REACT_APP_API_URL}/wp/v2/borrower-profile`, {
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
                  {borrowers.map((borrower) => {
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
                              src={getAvatarByBorrowerId(borrower.id)}
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
