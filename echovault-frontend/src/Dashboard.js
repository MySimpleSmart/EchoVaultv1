import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BorrowerList from './BorrowerList';
import BorrowerDetail from './BorrowerDetail';
import BorrowerProfile from './BorrowerProfile';

const Dashboard = ({ 
  currentView, 
  borrowers, 
  selectedBorrower, 
  onSelectBorrower, 
  onCreateNew, 
  onEdit, 
  onBack,
  loading,
  error,
  token 
}) => {
  const navigate = useNavigate();
  const [loans, setLoans] = useState([]);
  const [loansLoading, setLoansLoading] = useState(false);
  const [systemStatus, setSystemStatus] = useState({
    backend: { status: 'checking', message: 'Checking...' },
    database: { status: 'checking', message: 'Checking...' },
    fileStorage: { status: 'checking', message: 'Checking...' }
  });
  const [recentClients, setRecentClients] = useState([]);
  const [recentNotes, setRecentNotes] = useState([]);
  const [recentLoans, setRecentLoans] = useState([]);
  const [recentLoading, setRecentLoading] = useState(false);
  
  useEffect(() => {
    if (!token || currentView !== 'dashboard') return;
    
    const fetchLoans = async () => {
      setLoansLoading(true);
      try {
        const apiBase = (typeof window !== 'undefined' && window.REACT_APP_API_URL) || process.env.REACT_APP_API_URL || `${window.location.origin}/wp-json`;
        const response = await fetch(
          `${apiBase}/wp/v2/loans?per_page=100&status=publish,draft&context=edit`,
          { 
            headers: { 'Authorization': `Bearer ${token}` },
            mode: 'cors'
          }
        );
        if (response.ok) {
          const loansData = await response.json();
          setLoans(loansData || []);
        }
      } catch (e) {
        console.error('Failed to fetch loans for dashboard:', e);
      } finally {
        setLoansLoading(false);
      }
    };
    
    fetchLoans();
  }, [token, currentView]);

  // Check system status
  useEffect(() => {
    if (!token || currentView !== 'dashboard') return;

    const checkSystemStatus = async () => {
      const apiBase = (typeof window !== 'undefined' && window.REACT_APP_API_URL) || process.env.REACT_APP_API_URL || `${window.location.origin}/wp-json`;
      
      // Check Backend Connection
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const backendResponse = await fetch(`${apiBase}/wp/v2/`, {
          headers: { 'Authorization': `Bearer ${token}` },
          mode: 'cors',
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (backendResponse.ok) {
          setSystemStatus(prev => ({
            ...prev,
            backend: { status: 'online', message: 'Connected' }
          }));
        } else {
          setSystemStatus(prev => ({
            ...prev,
            backend: { status: 'error', message: 'Connection Failed' }
          }));
        }
      } catch (error) {
        setSystemStatus(prev => ({
          ...prev,
          backend: { status: 'error', message: 'Connection Failed' }
        }));
      }

      // Check Database (by trying to fetch a simple endpoint)
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const dbResponse = await fetch(`${apiBase}/wp/v2/loans?per_page=1`, {
          headers: { 'Authorization': `Bearer ${token}` },
          mode: 'cors',
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (dbResponse.ok) {
          setSystemStatus(prev => ({
            ...prev,
            database: { status: 'online', message: 'Online' }
          }));
        } else {
          setSystemStatus(prev => ({
            ...prev,
            database: { status: 'error', message: 'Offline' }
          }));
        }
      } catch (error) {
        setSystemStatus(prev => ({
          ...prev,
          database: { status: 'error', message: 'Offline' }
        }));
      }

      // Check File Storage (by checking if media endpoint is accessible)
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const storageResponse = await fetch(`${apiBase}/wp/v2/media?per_page=1`, {
          headers: { 'Authorization': `Bearer ${token}` },
          mode: 'cors',
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (storageResponse.ok) {
          setSystemStatus(prev => ({
            ...prev,
            fileStorage: { status: 'online', message: 'Available' }
          }));
        } else {
          setSystemStatus(prev => ({
            ...prev,
            fileStorage: { status: 'error', message: 'Unavailable' }
          }));
        }
      } catch (error) {
        setSystemStatus(prev => ({
          ...prev,
          fileStorage: { status: 'error', message: 'Unavailable' }
        }));
      }
    };

    checkSystemStatus();
  }, [token, currentView]);

  // Fetch recent data
  useEffect(() => {
    if (!token || currentView !== 'dashboard') return;

    const fetchRecentData = async () => {
      setRecentLoading(true);
      const apiBase = (typeof window !== 'undefined' && window.REACT_APP_API_URL) || process.env.REACT_APP_API_URL || `${window.location.origin}/wp-json`;
      const headers = { 'Authorization': `Bearer ${token}` };

      try {
        // Fetch recent clients (borrowers) - last 5, ordered by date
        try {
          const clientsResponse = await fetch(
            `${apiBase}/wp/v2/borrower-profile?per_page=5&orderby=date&order=desc&context=edit`,
            { headers, mode: 'cors' }
          );
          if (clientsResponse.ok) {
            const clientsData = await clientsResponse.json();
            setRecentClients(clientsData || []);
          }
        } catch (e) {
          // Silently handle error
        }

        // Fetch recent notes - last 5, ordered by date
        try {
          const possibleEndpoints = ['notes', 'note-system', 'note'];
          for (const endpoint of possibleEndpoints) {
            try {
              const notesResponse = await fetch(
                `${apiBase}/wp/v2/${endpoint}?per_page=5&orderby=date&order=desc&status=publish,draft`,
                { headers, mode: 'cors' }
              );
              if (notesResponse.ok) {
                const notesData = await notesResponse.json();
                setRecentNotes(notesData || []);
                break;
              }
            } catch (e) {
              // Continue to next endpoint
            }
          }
        } catch (e) {
          // Silently handle error
        }

        // Fetch recent loans - last 5, ordered by date
        try {
          const loansResponse = await fetch(
            `${apiBase}/wp/v2/loans?per_page=5&orderby=date&order=desc&status=publish,draft&context=edit`,
            { headers, mode: 'cors' }
          );
          if (loansResponse.ok) {
            const loansData = await loansResponse.json();
            setRecentLoans(loansData || []);
          }
        } catch (e) {
          // Silently handle error
        }
      } finally {
        setRecentLoading(false);
      }
    };

    fetchRecentData();
  }, [token, currentView]);
  
  // Calculate stats
  const activeLoans = loans.filter(loan => {
    const status = loan.loan_status || loan.meta?.loan_status || '';
    return status && !/^(closed|completed|cancelled)$/i.test(status);
  });
  
  const pendingApplications = loans.filter(loan => {
    const status = loan.loan_status || loan.meta?.loan_status || '';
    return status && /^(pending|draft)$/i.test(status);
  });
  
  const totalValue = loans.reduce((sum, loan) => {
    const amount = parseFloat(loan.loan_amount || loan.meta?.loan_amount || 0);
    return sum + amount;
  }, 0);
  
  // Default onCreateNew handler if not provided
  const handleCreateNew = onCreateNew || (() => navigate('/clients/new'));
  
  // Default handler for View All Borrowers
  const handleViewAllBorrowers = () => navigate('/clients');
  // Dashboard overview
  if (currentView === 'dashboard') {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Dashboard Overview</h1>
          <p className="text-gray-600">Welcome to your loan management system</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Borrowers</p>
                <p className="text-2xl font-bold text-gray-900">{borrowers.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Loans</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loansLoading ? '...' : activeLoans.length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending Applications</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loansLoading ? '...' : pendingApplications.length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Value</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loansLoading ? '...' : `$${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity Boards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Recent Clients */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Recent Clients</h3>
              <button
                onClick={() => navigate('/clients')}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                View All
              </button>
            </div>
            {recentLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-sm text-gray-500 mt-2">Loading...</p>
              </div>
            ) : recentClients.length > 0 ? (
              <div className="space-y-3">
                {recentClients.map((client) => {
                  const fullName = `${client.first_name || client.meta?.first_name || ''} ${client.last_name || client.meta?.last_name || ''}`.trim() || client.title?.rendered || 'Unknown Client';
                  const createdDate = client.date || client.date_gmt || '';
                  const formattedDate = createdDate ? new Date(createdDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
                  
                  return (
                    <div
                      key={client.id}
                      onClick={() => navigate(`/clients/${client.id}`)}
                      className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{fullName}</p>
                          <p className="text-xs text-gray-500 mt-1">{formattedDate}</p>
                        </div>
                        <svg className="w-5 h-5 text-gray-400 ml-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500">No recent clients</p>
              </div>
            )}
          </div>

          {/* Recent Notes */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Recent Notes</h3>
              <button
                onClick={() => navigate('/notes')}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                View All
              </button>
            </div>
            {recentLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-sm text-gray-500 mt-2">Loading...</p>
              </div>
            ) : recentNotes.length > 0 ? (
              <div className="space-y-3">
                {recentNotes.map((note) => {
                  const noteTitle = note.note_title || note.title?.rendered || note.title || 'Untitled Note';
                  const noteType = note.note_type || note.meta?.note_type || 'General';
                  const createdDate = note.date || note.date_gmt || '';
                  const formattedDate = createdDate ? new Date(createdDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
                  
                  return (
                    <div
                      key={note.id}
                      onClick={() => navigate('/notes')}
                      className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{noteTitle}</p>
                          <div className="flex items-center mt-1 space-x-2">
                            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded">{noteType}</span>
                            <span className="text-xs text-gray-500">{formattedDate}</span>
                          </div>
                        </div>
                        <svg className="w-5 h-5 text-gray-400 ml-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500">No recent notes</p>
              </div>
            )}
          </div>

          {/* Recent Loans */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Recent Loans</h3>
              <button
                onClick={() => navigate('/loans')}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                View All
              </button>
            </div>
            {recentLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-sm text-gray-500 mt-2">Loading...</p>
              </div>
            ) : recentLoans.length > 0 ? (
              <div className="space-y-3">
                {recentLoans.map((loan) => {
                  const loanId = loan.loan_id || loan.meta?.loan_id || loan.title?.rendered || `#${loan.id}`;
                  const loanAmount = loan.loan_amount || loan.meta?.loan_amount || 0;
                  const loanStatus = loan.loan_status || loan.meta?.loan_status || 'Active';
                  const createdDate = loan.date || loan.date_gmt || '';
                  const formattedDate = createdDate ? new Date(createdDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
                  
                  return (
                    <div
                      key={loan.id}
                      onClick={() => navigate(`/loans/${loan.id}`)}
                      className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{loanId}</p>
                          <div className="flex items-center mt-1 space-x-2">
                            <span className="text-xs text-gray-600">${parseFloat(loanAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded">{loanStatus}</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">{formattedDate}</p>
                        </div>
                        <svg className="w-5 h-5 text-gray-400 ml-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500">No recent loans</p>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <button
                onClick={handleViewAllBorrowers}
                className="w-full flex items-center justify-between p-3 bg-blue-50 hover:bg-blue-100 rounded-lg"
              >
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg mr-3">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-900">View All Borrowers</p>
                    <p className="text-sm text-gray-500">Manage borrower profiles</p>
                  </div>
                </div>
              </button>

              <button
                onClick={handleCreateNew}
                className="w-full flex items-center justify-between p-3 bg-green-50 hover:bg-green-100 rounded-lg"
              >
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg mr-3">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-900">Create New Profile</p>
                    <p className="text-sm text-gray-500">Add a new borrower</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => navigate('/loans')}
                className="w-full flex items-center justify-between p-3 bg-indigo-50 hover:bg-indigo-100 rounded-lg"
              >
                <div className="flex items-center">
                  <div className="p-2 bg-indigo-100 rounded-lg mr-3">
                    <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-900">View All Loans</p>
                    <p className="text-sm text-gray-500">Manage loan applications</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => navigate('/loans/new')}
                className="w-full flex items-center justify-between p-3 bg-purple-50 hover:bg-purple-100 rounded-lg"
              >
                <div className="flex items-center">
                  <div className="p-2 bg-purple-100 rounded-lg mr-3">
                    <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-900">Create a New Loan</p>
                    <p className="text-sm text-gray-500">Add a new loan application</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => navigate('/notes')}
                className="w-full flex items-center justify-between p-3 bg-yellow-50 hover:bg-yellow-100 rounded-lg"
              >
                <div className="flex items-center">
                  <div className="p-2 bg-yellow-100 rounded-lg mr-3">
                    <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-900">Note</p>
                    <p className="text-sm text-gray-500">View and manage notes</p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">System Status</h3>
            <div className="space-y-3">
              <div className={`flex items-center justify-between p-3 rounded-lg ${
                systemStatus.backend.status === 'online' ? 'bg-green-50' :
                systemStatus.backend.status === 'error' ? 'bg-red-50' :
                'bg-gray-50'
              }`}>
                <span className="text-sm font-medium text-gray-900">Backend Connection</span>
                <span className={`text-sm font-medium ${
                  systemStatus.backend.status === 'online' ? 'text-green-600' :
                  systemStatus.backend.status === 'error' ? 'text-red-600' :
                  'text-gray-600'
                }`}>
                  {systemStatus.backend.message}
                </span>
              </div>
              <div className={`flex items-center justify-between p-3 rounded-lg ${
                systemStatus.database.status === 'online' ? 'bg-green-50' :
                systemStatus.database.status === 'error' ? 'bg-red-50' :
                'bg-gray-50'
              }`}>
                <span className="text-sm font-medium text-gray-900">Database</span>
                <span className={`text-sm font-medium ${
                  systemStatus.database.status === 'online' ? 'text-green-600' :
                  systemStatus.database.status === 'error' ? 'text-red-600' :
                  'text-gray-600'
                }`}>
                  {systemStatus.database.message}
                </span>
              </div>
              <div className={`flex items-center justify-between p-3 rounded-lg ${
                systemStatus.fileStorage.status === 'online' ? 'bg-green-50' :
                systemStatus.fileStorage.status === 'error' ? 'bg-red-50' :
                'bg-gray-50'
              }`}>
                <span className="text-sm font-medium text-gray-900">File Storage</span>
                <span className={`text-sm font-medium ${
                  systemStatus.fileStorage.status === 'online' ? 'text-green-600' :
                  systemStatus.fileStorage.status === 'error' ? 'text-red-600' :
                  'text-gray-600'
                }`}>
                  {systemStatus.fileStorage.message}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Borrowers list
  if (currentView === 'borrowers') {
    return (
      <div className="p-6">
        <BorrowerList
          borrowers={borrowers}
          loading={loading}
          error={error}
          onSelectBorrower={onSelectBorrower}
          onCreateNew={onCreateNew}
        />
      </div>
    );
  }

  // Borrower detail
  if (currentView === 'borrower-detail' && selectedBorrower) {
    return (
      <div className="p-6">
        <BorrowerDetail
          borrower={selectedBorrower}
          onBack={onBack}
          onEdit={onEdit}
        />
      </div>
    );
  }

  // Create/Edit borrower profile
  if (currentView === 'create-borrower' || currentView === 'edit-borrower') {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {currentView === 'edit-borrower' ? 'Edit Borrower Profile' : 'Create New Borrower Profile'}
          </h1>
          <p className="text-gray-600">Create or update borrower information</p>
        </div>
        <BorrowerProfile
          editingBorrower={currentView === 'edit-borrower' ? selectedBorrower : null}
          isEditing={currentView === 'edit-borrower'}
          onCancel={onBack}
        />
      </div>
    );
  }

  // Reports view
  if (currentView === 'reports') {
    return (
      <div className="p-6">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Reports</h1>
              <p className="text-gray-600">Generate and view system reports and analytics</p>
            </div>
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 self-start sm:self-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>Generate Report</span>
            </button>
          </div>
        </div>

        {/* Empty State */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No reports found</h3>
          <p className="text-gray-500 mb-8 max-w-md mx-auto">Get started by generating your first report. This will help you analyze loan data, track performance, and monitor system metrics.</p>
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 mx-auto">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>Generate First Report</span>
          </button>
        </div>
      </div>
    );
  }

  // Settings view
  if (currentView === 'settings') {
    return (
      <div className="p-6">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Settings</h1>
              <p className="text-gray-600">Configure system settings and preferences</p>
            </div>
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 self-start sm:self-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>Add Setting</span>
            </button>
          </div>
        </div>

        {/* Empty State */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No settings configured</h3>
          <p className="text-gray-500 mb-8 max-w-md mx-auto">Get started by configuring your first system setting. This will help you customize the application behavior and preferences.</p>
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 mx-auto">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>Configure First Setting</span>
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default Dashboard;
