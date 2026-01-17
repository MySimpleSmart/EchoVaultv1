import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams, useLocation, Navigate } from 'react-router-dom';
import Login from './Login';
import Sidebar from './Sidebar';
import Header from './Header';
import Dashboard from './Dashboard';
import LoansActive from './LoansActive';
import LoansDetail from './LoansDetail';
import LoanProducts from './LoanProducts';
import CreateLoan from './CreateLoan';
import LoanContract from './LoanContract';
import BankAccounts from './BankAccounts';
import Notes from './Notes';
import Reports from './Reports';
import Settings from './Settings';
import AdminProfile from './AdminProfile';
import BorrowerProfile from './BorrowerProfile';
import './App.css';
import './styles.css';

// Main App Layout Component (uses React Router)
function MainApp() {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [borrowers, setBorrowers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editingLoan, setEditingLoan] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const savedToken = localStorage.getItem('jwt_token');
    const savedUser = localStorage.getItem('user');
    
    if (savedToken) {
      setToken(savedToken);
    }
      if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error('Error parsing user data:', e);
      }
    }

    // Support legacy query params for backward compatibility
    const params = new URLSearchParams(location.search);
      const view = params.get('view');
      const borrowerId = params.get('borrowerId');
      const loanId = params.get('loanId');
    
    if (view === 'borrower-detail' && borrowerId) {
      navigate(`/clients/${borrowerId}`, { replace: true });
    } else if (view === 'loan-detail' && loanId) {
      navigate(`/loans/${loanId}`, { replace: true });
    } else if (view && location.pathname === '/') {
      // Map old view names to new routes (only if on root path)
      const routeMap = {
        'dashboard': '/',
        'borrowers': '/clients',
        'create-borrower': '/clients/new',
        'loans-active': '/loans',
        'loans-create': '/loans/new',
        'loan-requests': '/loan-requests',
        'loan-requests-create': '/loan-requests/new',
        'loan-calculator': '/loan-calculator',
        'loan-products': '/loan-products',
        'loan-contract': '/loan-contract',
        'bank-accounts': '/bank-accounts',
        'notes': '/notes',
        'reports': '/reports',
        'settings': '/settings',
        'admin-profile': '/admin-profile'
      };
      if (routeMap[view]) {
        navigate(routeMap[view], { replace: true });
      }
    }
  }, [navigate, location]);

  const handleLogout = () => {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('borrowerProfile');
    localStorage.removeItem('user');
    // Reload to show login screen
    window.location.href = '/';
  };

  const refreshBorrowers = async () => {
    if (token) {
      setLoading(true);
      setError(null);
      try {
        const apiBase = (typeof window !== 'undefined' && window.REACT_APP_API_URL) || process.env.REACT_APP_API_URL || `${window.location.origin}/wp-json`;
        const response = await fetch(`${apiBase}/wp/v2/borrower-profile`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          mode: 'cors'
        });

        if (response.ok) {
          const data = await response.json();
          setBorrowers(data);
        } else {
          setError('Failed to fetch borrowers');
        }
      } catch (err) {
        setError('Network error occurred');
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (token) {
      refreshBorrowers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Helper to get current view from pathname
  const getCurrentView = () => {
    const path = location.pathname;
    if (path === '/' || path === '/dashboard') return 'dashboard';
    if (path.startsWith('/clients')) {
      if (path === '/clients/new') return 'create-borrower';
      if (path.match(/^\/clients\/\d+$/)) return 'borrower-detail';
      if (path.match(/^\/clients\/\d+\/edit$/)) return 'edit-borrower';
      return 'borrowers';
    }
    if (path.startsWith('/loans')) {
      if (path === '/loans/new') return 'loans-create';
      if (path.match(/^\/loans\/\d+$/)) return 'loan-detail';
      return 'loans-active';
      }
    if (path === '/loan-requests') return 'loan-requests';
    if (path === '/loan-requests/new') return 'loan-requests-create';
    if (path === '/loan-calculator') return 'loan-calculator';
    if (path === '/loan-products') return 'loan-products';
    if (path === '/loan-contract') return 'loan-contract';
    if (path === '/bank-accounts') return 'bank-accounts';
    if (path === '/notes') return 'notes';
    if (path === '/reports') return 'reports';
    if (path === '/settings') return 'settings';
    if (path === '/admin-profile') return 'admin-profile';
    return 'dashboard';
  };

  const currentView = getCurrentView();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        <Sidebar 
          currentView={currentView} 
          setCurrentView={(view) => {
            const routeMap = {
              'dashboard': '/',
              'borrowers': '/clients',
              'create-borrower': '/clients/new',
              'loans-active': '/loans',
              'loans-create': '/loans/new',
              'loan-requests': '/loan-requests',
              'loan-requests-create': '/loan-requests/new',
              'loan-calculator': '/loan-calculator',
              'loan-products': '/loan-products',
              'loan-contract': '/loan-contract',
              'bank-accounts': '/bank-accounts',
              'notes': '/notes',
              'reports': '/reports',
              'settings': '/settings',
              'admin-profile': '/admin-profile'
            };
            const route = routeMap[view];
            if (route) {
              navigate(route);
            if (view === 'borrowers') {
              refreshBorrowers();
              }
            }
          }}
          onCreateNew={() => navigate('/clients/new')}
        />
        <div className="flex-1 flex flex-col">
          <Header 
            onLogout={handleLogout} 
            user={user} 
            onNavigateToProfile={() => navigate('/admin-profile')} 
          />
          <Routes>
            <Route path="/" element={<Dashboard currentView="dashboard" borrowers={borrowers} loading={loading} error={error} token={token} onCreateNew={() => navigate('/clients/new')} />} />
            <Route path="/dashboard" element={<Navigate to="/" replace />} />
            
            {/* Client Routes */}
            <Route path="/clients" element={
              <Dashboard
                currentView="borrowers"
                borrowers={borrowers}
                onSelectBorrower={(b) => navigate(`/clients/${b.id}`)}
                onCreateNew={() => navigate('/clients/new')}
                loading={loading}
                error={error}
              />
            } />
            <Route path="/clients/new" element={
              <Dashboard
                currentView="create-borrower"
                borrowers={borrowers}
                onCreateNew={() => navigate('/clients/new')}
                onBack={() => navigate('/')}
                loading={loading}
                error={error}
              />
            } />
            <Route path="/clients/:id" element={<ClientDetailWrapper token={token} navigate={navigate} borrowers={borrowers} />} />
            <Route path="/clients/:id/edit" element={<ClientEditWrapper token={token} navigate={navigate} />} />
            
            {/* Loan Routes */}
            <Route path="/loans" element={
            <div className="p-6">
              <div className="mb-8">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Loans</h1>
                    <p className="text-gray-600">Manage and view loan applications and approvals</p>
                  </div>
                  <button
                      onClick={() => navigate('/loans/new')}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 self-start sm:self-center"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span>Create New Loan</span>
                  </button>
                </div>
              </div>
                <LoansActive 
                  token={token} 
                  setCurrentView={(v) => {
                    if (typeof v === 'object' && v.view === 'loan-detail') {
                      navigate(`/loans/${v.loanId}`);
                    } else if (typeof v === 'string') {
                      const routeMap = {
                        'loans-create': '/loans/new',
                        'loans-active': '/loans'
                      };
                      if (routeMap[v]) navigate(routeMap[v]);
                    }
                  }} 
                />
              </div>
            } />
            <Route path="/loans/new" element={
              <div className="p-6">
                <CreateLoan 
                  token={token} 
                  setCurrentView={(view) => {
                    setEditingLoan(null);
                    if (view === 'loans-active') navigate('/loans');
                    else if (view === 'loan-detail' && editingLoan) navigate(`/loans/${editingLoan.id}`);
                  }}
                  onOpenBorrower={(id) => {
                    window.open(`${window.location.origin}/clients/${id}`, '_blank', 'noopener');
                  }}
                  editingLoan={editingLoan}
                />
              </div>
            } />
            <Route path="/loans/:id" element={<LoanDetailWrapper token={token} navigate={navigate} setEditingLoan={setEditingLoan} />} />
            
            {/* Other Routes */}
            <Route path="/loan-requests" element={<LoanRequestsPage navigate={navigate} />} />
            <Route path="/loan-requests/new" element={<LoanRequestCreatePage />} />
            <Route path="/loan-calculator" element={<LoanCalculatorPage />} />
            <Route path="/loan-products" element={<div className="p-6"><LoanProducts token={token} /></div>} />
            <Route path="/loan-contract" element={<div className="p-6"><LoanContract /></div>} />
            <Route path="/bank-accounts" element={<div className="p-6"><BankAccounts token={token} setCurrentView={(v) => {
              const routeMap = {
                'loans-active': '/loans',
                'loan-detail': (id) => `/loans/${id}`
              };
                if (typeof v === 'object' && v.view === 'loan-detail') {
                navigate(`/loans/${v.loanId}`);
              }
            }} /></div>} />
            <Route path="/notes" element={<div className="p-6"><Notes token={token} /></div>} />
            <Route path="/reports" element={<div className="p-6"><Reports /></div>} />
            <Route path="/settings" element={<div className="p-6"><Settings /></div>} />
            <Route path="/admin-profile" element={<div className="p-6"><AdminProfile user={user} token={token} /></div>} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

// Wrapper components for routes with params
function ClientDetailWrapper({ token, navigate, borrowers }) {
  const { id } = useParams();
  const [borrower, setBorrower] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (token && id) {
      setLoading(true);
      const apiBase = (typeof window !== 'undefined' && window.REACT_APP_API_URL) || process.env.REACT_APP_API_URL || `${window.location.origin}/wp-json`;
      fetch(`${apiBase}/wp/v2/borrower-profile/${id}?context=edit`, {
        headers: { 'Authorization': `Bearer ${token}` },
        mode: 'cors'
      })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          setBorrower(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [token, id]);

  // Also check if borrower is in the borrowers list
  useEffect(() => {
    if (!borrower && borrowers && borrowers.length > 0) {
      const found = borrowers.find(b => String(b.id) === String(id));
      if (found) setBorrower(found);
    }
  }, [borrowers, id, borrower]);

  return (
    <Dashboard
      currentView="borrower-detail"
      borrowers={borrowers}
      selectedBorrower={borrower}
      onSelectBorrower={() => {}}
      onCreateNew={() => navigate('/clients/new')}
      onEdit={(b) => navigate(`/clients/${b.id}/edit`)}
      onBack={() => navigate('/clients')}
      loading={loading && !borrower}
      error={null}
    />
  );
}

function ClientEditWrapper({ token, navigate }) {
  const { id } = useParams();
  const [borrower, setBorrower] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (token && id) {
      setLoading(true);
      const apiBase = (typeof window !== 'undefined' && window.REACT_APP_API_URL) || process.env.REACT_APP_API_URL || `${window.location.origin}/wp-json`;
      fetch(`${apiBase}/wp/v2/borrower-profile/${id}?context=edit`, {
        headers: { 'Authorization': `Bearer ${token}` },
        mode: 'cors'
      })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          setBorrower(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [token, id]);
  
  if (loading) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500">Loading borrower data...</p>
      </div>
    );
  }
  
  if (!borrower) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600">Failed to load borrower data.</p>
      </div>
    );
                }
  
  return (
    <div className="p-6">
      <BorrowerProfile
        editingBorrower={borrower}
        isEditing={true}
        onProfileComplete={() => navigate(`/clients/${id}`)}
        onCancel={() => navigate(`/clients/${id}`)}
        token={token}
      />
            </div>
  );
}

function LoanDetailWrapper({ token, navigate, setEditingLoan }) {
  const { id } = useParams();
  
  return (
            <div className="p-6">
              <LoansDetail 
                token={token} 
        loanId={id} 
        onBack={() => navigate('/loans')} 
        onOpenBorrower={(borrowerId) => {
          window.open(`${window.location.origin}/clients/${borrowerId}`, '_blank', 'noopener');
                }}
                onEditLoan={(loan) => {
                  setEditingLoan(loan);
          navigate('/loans/new');
                }}
              />
            </div>
  );
}

function LoanRequestsPage({ navigate }) {
  return (
            <div className="p-6">
              <div className="mb-8">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Loan Requests</h1>
                    <p className="text-gray-600">Review and process incoming loan requests</p>
                  </div>
                  <button
            onClick={() => navigate('/loan-requests/new')}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 self-start sm:self-center"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span>Create Loan Request</span>
                  </button>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No loan requests</h3>
                <p className="text-gray-500 mb-8 max-w-md mx-auto">New loan requests submitted by borrowers will be listed here for your review.</p>
                <button
          onClick={() => navigate('/loan-requests/new')}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 mx-auto"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Create Loan Request</span>
                </button>
              </div>
            </div>
  );
}

function LoanRequestCreatePage() {
  return (
            <div className="p-6">
              <div className="mb-8">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Create Loan Request</h1>
                    <p className="text-gray-600">Start a new loan request for a borrower</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-8 4h10M7 8h10" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Form coming soon</h3>
                <p className="text-gray-500 max-w-md mx-auto">We will add the loan request form here with borrower selection and product details.</p>
              </div>
            </div>
  );
}

function LoanCalculatorPage() {
  return (
            <div className="p-6">
              <div className="mb-8">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Loan Calculator</h1>
                    <p className="text-gray-600">Estimate repayments and terms</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h10M7 11h10M9 15h6M9 19h6" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Calculator coming soon</h3>
                <p className="text-gray-500 max-w-md mx-auto">We will add repayment and term estimation here with inputs and instant results.</p>
              </div>
            </div>
  );
}

// Main App Component
function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const savedToken = localStorage.getItem('jwt_token');
    if (savedToken) {
      setIsLoggedIn(true);
    }
  }, []);

  const handleLogin = (token, userData) => {
    setIsLoggedIn(true);
    localStorage.setItem('jwt_token', token);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  if (!isLoggedIn) {
    return <Login onLoginSuccess={handleLogin} />;
  }

  return (
    <BrowserRouter>
      <MainApp />
    </BrowserRouter>
  );
}

export default App;
