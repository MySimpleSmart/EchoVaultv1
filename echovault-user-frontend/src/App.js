import React, { useEffect, useState, useMemo } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  useNavigate,
  useParams,
  useLocation
} from 'react-router-dom';
import Login from './Login';
import Sidebar from './Sidebar';
import Header from './Header';
import './App.css';
import './styles.css';

const apiBase =
  (typeof window !== 'undefined' && window.REACT_APP_API_URL) ||
  process.env.REACT_APP_API_URL ||
  `${window.location.origin}/wp-json`;

function getAuthHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  };
}

// Helper function to extract ID from various formats (matching admin side logic)
const toId = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number' || typeof val === 'string') return String(val);
  if (Array.isArray(val)) return toId(val[0]);
  if (typeof val === 'object') {
    if ('id' in val) return String(val.id);
    if ('ID' in val) return String(val.ID);
  }
  return '';
};

// Helper function to check if a loan belongs to a borrower profile
const isLoanForBorrower = (loan, profile) => {
  if (!loan || !profile) return false;
  
  const profileId = String(profile.id);
  const profileEmail = (profile.email_address || profile.meta?.email_address || '').toString().toLowerCase().trim();
  
  // Try multiple ways to extract borrower ID from loan (matching admin side logic)
  let borrowerId = toId(loan.meta?.borrower_id) 
    || toId(loan.borrower) 
    || toId(loan.meta?.borrower) 
    || toId(loan.meta?.borrower_profile)
    || toId(loan.fields?.borrower_id) 
    || toId(loan.acf?.borrower_id)
    || toId(loan.fields?.borrower)
    || toId(loan.acf?.borrower);
  
  // Check if borrower ID matches
  if (borrowerId && String(borrowerId) === profileId) {
    return true;
  }
  
  // Fallback: check by email if available
  if (profileEmail) {
    const loanBorrowerEmail = (loan.meta?.borrower_email || loan.fields?.borrower_email || '').toString().toLowerCase().trim();
    if (loanBorrowerEmail && loanBorrowerEmail === profileEmail) {
      return true;
    }
  }
  
  return false;
};

function useCurrentClient(token) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        // 1) Get email from locally stored user (set at login)
        let userEmail = '';
        try {
          const stored = localStorage.getItem('user');
          if (stored) {
            const parsed = JSON.parse(stored);
            userEmail =
              (parsed.user_email || parsed.email || '')
                .toString()
                .toLowerCase()
                .trim();
          }
        } catch (_) {}

        // 2) Fallback to /users/me only if we couldn't get it from localStorage
        if (!userEmail) {
          const meResp = await fetch(`${apiBase}/wp/v2/users/me`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            mode: 'cors',
          });

          if (meResp.ok) {
            const me = await meResp.json();
            userEmail = (
              me.email ||
              me.user_email ||
              me.user_email_address ||
              ''
            )
              .toString()
              .toLowerCase()
              .trim();
          }
        }

        if (!userEmail) {
          throw new Error('Current user email not found');
        }

        // 2) Load all borrowers visible to this token
        const listResp = await fetch(
          `${apiBase}/wp/v2/borrower-profile?per_page=100&context=edit`,
          { headers: getAuthHeaders(token), mode: 'cors' }
        );

        if (!listResp.ok) {
          throw new Error('Failed to load borrower profiles');
        }

        const list = await listResp.json();

        let matched = null;
        if (Array.isArray(list) && list.length) {
          matched =
            list.find((b) => {
              const be = (
                b.email_address ||
                b.email ||
                b.meta?.email_address ||
                b.fields?.email_address ||
                b.meta?.borrower_email ||
                b.fields?.borrower_email ||
                ''
              )
                .toString()
                .toLowerCase()
                .trim();
              return be && be === userEmail;
            }) || null;
        }

        if (!matched) {
          throw new Error('No borrower profile found for this account');
        }

        if (!cancelled) {
          setProfile(matched);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message || 'Failed to load profile');
          setProfile(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return { profile, loading, error };
}

function DashboardPage({ token, user }) {
  const { profile, loading, error } = useCurrentClient(token);
  const [loans, setLoans] = useState([]);
  const [loanError, setLoanError] = useState('');

  useEffect(() => {
    if (!token || !profile) return;
    const loadLoans = async () => {
      try {
        setLoanError('');
        const resp = await fetch(
          `${apiBase}/wp/v2/loans?per_page=100&context=edit`,
          { headers: getAuthHeaders(token), mode: 'cors' }
        );
        if (!resp.ok) throw new Error('Failed to load loans');
        const data = await resp.json();
        // Use comprehensive filtering function
        const filtered = data.filter((loan) => isLoanForBorrower(loan, profile));
        setLoans(filtered);
      } catch (e) {
        setLoanError(e.message || 'Failed to load loans');
      }
    };
    loadLoans();
  }, [token, profile]);

  const nextLoan = useMemo(() => loans[0] || null, [loans]);

  return (
    <div className="p-6">
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
      <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Dashboard</h1>
            <p className="text-gray-600">
              Welcome back, {user?.username || profile?.first_name || profile?.title?.rendered || 'Client'}
            </p>
          </div>
        </div>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading profile...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
        </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Loans</p>
              <p className="text-2xl font-bold text-gray-900">{loans.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 col-span-2">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4 flex-1">
              <p className="text-sm font-medium text-gray-600">Next Loan</p>
              {loanError && <p className="mt-1 text-sm text-red-600">{loanError}</p>}
          {!loanError && !nextLoan && (
                <p className="mt-1 text-sm text-gray-600">No active loans found.</p>
          )}
          {nextLoan && (
                <div className="mt-1">
                  <p className="text-lg font-semibold text-gray-900">
                {nextLoan.title?.rendered || nextLoan.loan_title || `Loan #${nextLoan.id}`}
              </p>
                  <p className="text-sm text-gray-500">
                Status: {nextLoan.meta?.loan_status || 'Active'}
              </p>
            </div>
          )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoansPage({ token }) {
  const { profile } = useCurrentClient(token);
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!token || !profile) return;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const resp = await fetch(
          `${apiBase}/wp/v2/loans?per_page=100&context=edit`,
          { headers: getAuthHeaders(token), mode: 'cors' }
        );
        if (!resp.ok) throw new Error('Failed to load loans');
        const data = await resp.json();
        // Use comprehensive filtering function
        const filtered = data.filter((loan) => isLoanForBorrower(loan, profile));
        setLoans(filtered);
      } catch (e) {
        setError(e.message || 'Failed to load loans');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token, profile]);

  return (
    <div className="p-6">
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
      <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">My Loans</h1>
            <p className="text-gray-600">View your active and past loans.</p>
          </div>
          <button
            onClick={() => navigate('/products')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 self-start sm:self-center"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>Apply a new loan</span>
          </button>
        </div>
      </div>
      {loading && <p className="text-sm text-gray-500">Loading loans...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && loans.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-600">You do not have any loans yet.</p>
        </div>
      )}
      {loans.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loan</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Balance</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Remaining Balance</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loans.map((loan) => {
                const currency = loan?.loan_currency || loan?.meta?.loan_currency || 'AUD';
                const getCurrencySymbol = (c) => (c === 'MNT' ? '₮' : '$');
                const totalBalance = loan.loan_amount || loan.meta?.loan_amount || 0;
                const remainingBalance = loan.remaining_balance || loan.meta?.remaining_balance || loan.meta?.remain_balance || totalBalance;
                
                return (
                <tr key={loan.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {loan.title?.rendered || loan.loan_title || `Loan #${loan.id}`}
                  </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {getCurrencySymbol(currency)}{parseFloat(totalBalance).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {getCurrencySymbol(currency)}{parseFloat(remainingBalance).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {loan.meta?.loan_status || 'Active'}
                  </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => navigate(`/loans/${loan.id}`)}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      View details
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LoanDetailPage({ token }) {
  const { id } = useParams();
  const { profile } = useCurrentClient(token);
  const [activeTab, setActiveTab] = useState('Loan Details');
  const [loan, setLoan] = useState(null);
  const [coBorrower, setCoBorrower] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!token || !id || !profile) return;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const loanResp = await fetch(
          `${apiBase}/wp/v2/loans/${id}?context=edit`,
          { headers: getAuthHeaders(token), mode: 'cors' }
        );
        if (!loanResp.ok) throw new Error('Failed to load loan');
        const loanJson = await loanResp.json();
        
        // Security check: verify this loan belongs to the current user
        if (!isLoanForBorrower(loanJson, profile)) {
          setError('You do not have permission to view this loan.');
          setLoading(false);
          return;
        }
        
        setLoan(loanJson);

        // Fetch co-borrower if exists
        const coStatus = loanJson.co_borrower_status || loanJson.meta?.co_borrower_status;
        const coId = toId(loanJson.meta?.co_borrower_id) || toId(loanJson.co_borrower) || toId(loanJson.meta?.co_borrower);
        if (coStatus && /^yes$/i.test(String(coStatus)) && coId) {
          try {
            const cbResp = await fetch(
              `${apiBase}/wp/v2/borrower-profile/${coId}?context=edit`,
              { headers: getAuthHeaders(token), mode: 'cors' }
            );
            if (cbResp.ok) {
              setCoBorrower(await cbResp.json());
            }
          } catch (e) {
            console.error('Failed to load co-borrower:', e);
          }
        }

        const scheduleResp = await fetch(
          `${apiBase}/echovault/v2/get-repayment-schedule?loan_id=${id}`,
          { headers: { Authorization: `Bearer ${token}` }, mode: 'cors' }
        );
        if (scheduleResp.ok) {
          const scheduleJson = await scheduleResp.json();
          if (scheduleJson.success && scheduleJson.schedule) {
            setSchedule(scheduleJson.schedule);
          }
        }
      } catch (e) {
        setError(e.message || 'Failed to load loan');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token, id, profile]);

  const currency = loan?.loan_currency || loan?.meta?.loan_currency || 'AUD';
  const getCurrencySymbol = (c) => (c === 'MNT' ? '₮' : '$');

  return (
    <div className="p-6">
      <div className="mb-8">
        <button
          onClick={() => navigate('/loans')}
          className="text-sm text-gray-600 hover:text-gray-900 mb-4 inline-flex items-center"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Loans
        </button>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Loan Details</h1>
      </div>
      {loading && <p className="text-sm text-gray-500">Loading...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      
      {loan && (
        <>
          {/* Tabs Navigation */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8 px-6">
                <button
                  type="button"
                  onClick={() => setActiveTab('Loan Details')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'Loan Details'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Loan Details
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('Repayment Schedule')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'Repayment Schedule'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Repayment Schedule
                </button>
              </nav>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'Loan Details' && (
            <>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Loan ID</p>
                    <p className="font-medium text-gray-900 mt-1">
            {loan.title?.rendered || loan.loan_title || `Loan #${loan.id}`}
          </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Status</p>
                    <p className="font-medium text-gray-900 mt-1">
                      {loan.meta?.loan_status || 'Active'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Repayment Status</p>
                    <div className="mt-1">
                      {(() => {
                        // Calculate overall repayment status from schedule
                        let overallStatus = 'Pending';
                        if (schedule && schedule.length > 0) {
                          const paidCount = schedule.filter(s => s.repayment_status === 'Paid').length;
                          const partialCount = schedule.filter(s => s.repayment_status === 'Partial').length;
                          const overdueCount = schedule.filter(s => s.repayment_status === 'Overdue').length;
                          
                          if (paidCount === schedule.length) {
                            overallStatus = 'Paid';
                          } else if (overdueCount > 0) {
                            overallStatus = 'Overdue';
                          } else if (partialCount > 0 || paidCount > 0) {
                            overallStatus = 'Partial';
                          } else {
                            overallStatus = 'Pending';
                          }
                        }
                        
                        const statusClass = 
                          overallStatus === 'Paid' ? 'bg-green-100 text-green-800' :
                          overallStatus === 'Partial' ? 'bg-yellow-100 text-yellow-800' :
                          overallStatus === 'Overdue' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800';
                        
                        return (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass}`}>
                            {overallStatus}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  <div>
                    <p className="text-gray-500">Loan Amount</p>
                    <p className="font-medium text-gray-900 mt-1">
                      {getCurrencySymbol(currency)}{loan.loan_amount || loan.meta?.loan_amount || '0'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Currency</p>
                    <p className="font-medium text-gray-900 mt-1">{currency}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Loan Product</p>
                    <p className="font-medium text-gray-900 mt-1">
                      {loan.loan_product || loan.meta?.loan_product_name || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Loan Interest</p>
                    <p className="font-medium text-gray-900 mt-1">
                      {loan.loan_interest || loan.meta?.loan_interest || '-'}%
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Loan Term</p>
                    <p className="font-medium text-gray-900 mt-1">
                      {loan.loan_term || loan.meta?.loan_term ? `${loan.loan_term || loan.meta?.loan_term} months` : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Repayment Method</p>
                    <p className="font-medium text-gray-900 mt-1">
                      {loan.repayment_method || loan.meta?.repayment_method || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Repayment Frequency</p>
                    <p className="font-medium text-gray-900 mt-1">
                      {Array.isArray(loan.repayment_frequency) ? loan.repayment_frequency[0] : (loan.repayment_frequency || loan.meta?.repayment_frequency || '-')}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Loan Start Date</p>
                    <p className="font-medium text-gray-900 mt-1">
                      {loan.start_date || loan.meta?.start_date || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Loan End Date</p>
                    <p className="font-medium text-gray-900 mt-1">
                      {loan.end_date || loan.meta?.end_date || '-'}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Repayment Account Details */}
              {(loan.loan_repayment_account || loan.meta?.loan_repayment_account) && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Repayment Account Details</h2>
                  <div className="text-sm">
                    <p className="text-gray-500">Repayment Account</p>
                    <p className="font-medium text-gray-900 mt-1 break-all">
                      {loan.loan_repayment_account || loan.meta?.loan_repayment_account || '-'}
                    </p>
                  </div>
        </div>
      )}

              {/* Co-borrower Details */}
              {coBorrower && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Co-borrower Details</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">First Name</p>
                      <p className="font-medium text-gray-900 mt-1">
                        {coBorrower.first_name || coBorrower.meta?.first_name || '-'}
                      </p>
          </div>
                    <div>
                      <p className="text-gray-500">Last Name</p>
                      <p className="font-medium text-gray-900 mt-1">
                        {coBorrower.last_name || coBorrower.meta?.last_name || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Email Address</p>
                      <p className="font-medium text-gray-900 mt-1 break-all">
                        {coBorrower.email_address || coBorrower.meta?.email_address || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Mobile Number</p>
                      <p className="font-medium text-gray-900 mt-1">
                        {coBorrower.mobile_number || coBorrower.meta?.mobile_number || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Date of Birth</p>
                      <p className="font-medium text-gray-900 mt-1">
                        {coBorrower.date_of_birth || coBorrower.meta?.date_of_birth || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Document Type</p>
                      <p className="font-medium text-gray-900 mt-1">
                        {coBorrower.document_type || coBorrower.meta?.document_type || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Document Number</p>
                      <p className="font-medium text-gray-900 mt-1">
                        {coBorrower.document_number || coBorrower.meta?.document_number || '-'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'Repayment Schedule' && (
            <>
              {schedule.length > 0 ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Repayment Schedule</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-xs">
            <thead className="bg-gray-50">
              <tr>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">#</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Start</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">End</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Days</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Start Balance</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Accrued Interest</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Paid Interest</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Paid Principal</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total Payment</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Outstanding</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Remain Balance</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
              <tbody className="bg-white divide-y divide-gray-200">
              {schedule.map((r, index) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-center">{index + 1}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{r.segment_start || '-'}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{r.segment_end || '-'}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right">{r.loan_days || 0}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
                      {getCurrencySymbol(currency)}{(r.start_balance || 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
                      {getCurrencySymbol(currency)}{(r.accrued_interest || 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
                      {getCurrencySymbol(currency)}{(r.paid_interest || 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
                      {getCurrencySymbol(currency)}{(r.paid_principles || 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
                      {getCurrencySymbol(currency)}{(r.total_payment || 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
                      {getCurrencySymbol(currency)}{(r.outstanding_interest || 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
                      {getCurrencySymbol(currency)}{(r.remain_balance || 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-center">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        r.repayment_status === 'Paid' ? 'bg-green-100 text-green-800' :
                        r.repayment_status === 'Partial' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                    {r.repayment_status || 'Pending'}
                      </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
              ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                  <p className="text-gray-600">No repayment schedule available.</p>
        </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function ProductsPage({ token }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const resp = await fetch(
          `${apiBase}/wp/v2/loan-product?per_page=100&status=publish`,
          { headers: getAuthHeaders(token), mode: 'cors' }
        );
        if (!resp.ok) throw new Error('Failed to load products');
        const data = await resp.json();
        setProducts(data || []);
      } catch (e) {
        setError(e.message || 'Failed to load products');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  return (
    <div className="p-6">
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Active Loan Products</h1>
            <p className="text-gray-600">Browse available loan products.</p>
          </div>
        </div>
      </div>
      {loading && <p className="text-sm text-gray-500">Loading products...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && products.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-600">No active products available.</p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((p) => (
          <div
            key={p.id}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {p.product_name || p.title?.rendered || 'Loan Product'}
            </h3>
            {p.product_description && (
              <p className="text-sm text-gray-600 mb-4">{p.product_description}</p>
            )}
            <div className="space-y-2 text-sm">
              {p.min_amount && (
                <p className="text-gray-600">
                  <span className="font-medium">Min Amount:</span> ${p.min_amount}
                </p>
              )}
              {p.max_amount && (
                <p className="text-gray-600">
                  <span className="font-medium">Max Amount:</span> ${p.max_amount}
                </p>
              )}
              {p.interest_rate && (
                <p className="text-gray-600">
                  <span className="font-medium">Interest Rate:</span> {p.interest_rate}%
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NewsPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const resp = await fetch(`${apiBase}/wp/v2/posts?per_page=5`, {
          mode: 'cors'
        });
        if (!resp.ok) throw new Error('Failed to load news');
        const data = await resp.json();
        setPosts(data || []);
      } catch (e) {
        setError(e.message || 'Failed to load news');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="p-6">
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">News</h1>
            <p className="text-gray-600">Latest updates and announcements.</p>
          </div>
        </div>
      </div>
      {loading && <p className="text-sm text-gray-500">Loading news...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="space-y-4">
        {posts.map((post) => (
          <article key={post.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {post.title?.rendered || 'News'}
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              {new Date(post.date).toLocaleDateString()}
            </p>
            <div
              className="text-sm text-gray-600 line-clamp-3"
              dangerouslySetInnerHTML={{ __html: post.excerpt?.rendered || post.content?.rendered || '' }}
            />
          </article>
        ))}
      </div>
    </div>
  );
}

// Avatar utility function
function getAvatarByBorrowerId(borrowerIdOrBorrower) {
  const avatarImages = [
    'monster.svg',
    'monster (1).svg',
    'monster (2).svg',
    'monster (3).svg',
    'monster (4).svg',
    'monster (5).svg',
    'monster (6).svg',
    'monster (7).svg',
    'monster (8).svg',
    'monster (9).svg',
    'monster (10).svg',
    'monster (11).svg',
    'monster (12).svg'
  ];

  let avatarFilename = null;
  
  if (typeof borrowerIdOrBorrower === 'object' && borrowerIdOrBorrower !== null) {
    const borrower = borrowerIdOrBorrower;
    let savedAvatar = borrower.avatar || 
                     borrower.meta?.avatar || 
                     borrower.fields?.avatar ||
                     (Array.isArray(borrower.avatar) ? borrower.avatar[0] : null) ||
                     (Array.isArray(borrower.meta?.avatar) ? borrower.meta.avatar[0] : null);
    
    if (savedAvatar && typeof savedAvatar === 'object') {
      savedAvatar = savedAvatar.name || savedAvatar.filename || savedAvatar.url || savedAvatar;
    }
    
    if (savedAvatar && typeof savedAvatar === 'string' && savedAvatar.trim()) {
      avatarFilename = savedAvatar.trim();
    }
    
    if (!avatarFilename) {
      const borrowerId = borrower.id || borrower.ID;
      if (borrowerId) {
        const avatarIndex = borrowerId % avatarImages.length;
        avatarFilename = avatarImages[avatarIndex];
      }
    }
  } else if (typeof borrowerIdOrBorrower === 'number') {
    const borrowerId = borrowerIdOrBorrower;
    const avatarIndex = borrowerId % avatarImages.length;
    avatarFilename = avatarImages[avatarIndex];
  }
  
  if (!avatarFilename) {
    avatarFilename = avatarImages[0];
  }
  
  return `/avatars/${avatarFilename}`;
}

function ProfilePage({ token }) {
  const { profile, loading, error } = useCurrentClient(token);
  const [activeTab, setActiveTab] = useState('general');

  const field = (val) =>
    val === null || val === undefined || val === '' ? '-' : String(val);

  const fullName = profile 
    ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown Client'
    : 'Unknown Client';
  const initials = fullName.split(' ').map(n => n[0]).join('').toUpperCase();

  return (
    <div className="p-6">
      {loading && <p className="text-sm text-gray-500">Loading profile...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && !profile && (
        <p className="text-sm text-gray-500">
          No client profile is linked to this account yet.
        </p>
      )}

      {profile && (
        <>
          {/* Header - matching admin side */}
          <div className="mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="flex items-center">
                <div className="flex items-center">
                  <img
                    src={getAvatarByBorrowerId(profile)}
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
                      <p className="text-gray-600">ID: {profile.id || '-'}</p>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Active
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

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

          {/* Tab content – read only */}
          <div className="p-6 text-sm text-gray-900">
            {activeTab === 'general' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-gray-500 mb-1">First Name</p>
                  <p className="font-medium">{field(profile.first_name)}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Last Name</p>
                  <p className="font-medium">{field(profile.last_name)}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Email</p>
                  <p className="font-medium">{field(profile.email_address)}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Borrower ID</p>
                  <p className="font-medium">
                    {field(profile.borrower_id || profile.meta?.borrower_id)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Date of Birth</p>
                  <p className="font-medium">{field(profile.date_of_birth)}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Mobile Number</p>
                  <p className="font-medium">{field(profile.mobile_number)}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Registration Number</p>
                  <p className="font-medium">
                    {field(profile.registration_number)}
                  </p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-gray-500 mb-1">Home Address</p>
                  <p className="font-medium whitespace-pre-line">
                    {field(profile.home_address)}
                  </p>
                </div>
        </div>
            )}

            {activeTab === 'visa' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-gray-500 mb-1">Visa Type</p>
                  <p className="font-medium">{field(profile.visa_type)}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Visa Expiry Date</p>
                  <p className="font-medium">
                    {field(profile.visa_expiry_date)}
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'employment' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-gray-500 mb-1">Employment Status</p>
                  <p className="font-medium">
                    {field(profile.employment_status)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Work Rights</p>
                  <p className="font-medium">{field(profile.work_rights)}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Employer Name</p>
                  <p className="font-medium">{field(profile.employer_name)}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Job Title</p>
                  <p className="font-medium">{field(profile.job_title)}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Monthly Income (AUD)</p>
                  <p className="font-medium">
                    {field(profile.monthly_income_aud)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Employment Start Date</p>
                  <p className="font-medium">
                    {field(profile.employment_start_date)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Employer Phone</p>
                  <p className="font-medium">
                    {field(profile.employer_phone)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Employer Email</p>
                  <p className="font-medium">
                    {field(profile.employer_email)}
                  </p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-gray-500 mb-1">Employer Address</p>
                  <p className="font-medium whitespace-pre-line">
                    {field(profile.employer_address)}
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'family' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-gray-500 mb-1">Marital Status</p>
                  <p className="font-medium">
                    {field(profile.marital_status)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Family Relationship</p>
                  <p className="font-medium">
                    {field(profile.family_relationship)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Family Member Name</p>
                  <p className="font-medium">
                    {field(profile.family_member_full_name)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Family Member Phone</p>
                  <p className="font-medium">
                    {field(profile.family_member_phone)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Family Member Email</p>
                  <p className="font-medium">
                    {field(profile.family_member_email)}
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'bank' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-gray-500 mb-1">Bank Name</p>
                  <p className="font-medium">{field(profile.bank_name)}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Account Name</p>
                  <p className="font-medium">{field(profile.account_name)}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">BSB Number</p>
                  <p className="font-medium">{field(profile.bsb_number)}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Account Number</p>
                  <p className="font-medium">{field(profile.account_number)}</p>
                </div>
              </div>
            )}
          </div>
        </div>
        </>
      )}
    </div>
  );
}

function ClientApp() {
  const [token, setToken] = useState(localStorage.getItem('jwt_token'));
  const [user, setUser] = useState(() => {
    try {
      const s = localStorage.getItem('user');
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  });
  const { profile } = useCurrentClient(token);
  const location = useLocation();

  const getCurrentView = () => {
    const path = location.pathname;
    if (path === '/' || path === '/dashboard') return 'dashboard';
    if (path.startsWith('/loans')) return 'loans';
    if (path === '/products') return 'products';
    if (path === '/news') return 'news';
    if (path === '/profile') return 'profile';
    return 'dashboard';
  };

  const handleLogout = () => {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user');
    window.location.reload();
  };

  if (!token) {
    return (
      <Login
        onLoginSuccess={(newToken, userData) => {
          setToken(newToken);
          setUser(userData);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        <Sidebar currentView={getCurrentView()} />
        <div className="flex-1 flex flex-col">
          <Header user={user} profile={profile} onLogout={handleLogout} />
        <Routes>
            <Route path="/" element={<DashboardPage token={token} user={user} />} />
            <Route path="/dashboard" element={<DashboardPage token={token} user={user} />} />
          <Route path="/loans" element={<LoansPage token={token} />} />
          <Route path="/loans/:id" element={<LoanDetailPage token={token} />} />
          <Route path="/products" element={<ProductsPage token={token} />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/profile" element={<ProfilePage token={token} />} />
        </Routes>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ClientApp />
    </BrowserRouter>
  );
}

export default App;
