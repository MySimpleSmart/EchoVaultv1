import React, { useState, useEffect } from 'react';
import Login from './Login';
import Sidebar from './Sidebar';
import Header from './Header';
import Dashboard from './Dashboard';
import Loans from './Loans';
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
import './App.css';
import './styles.css';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState(null);
  const [profileCompleted, setProfileCompleted] = useState(false);
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedBorrower, setSelectedBorrower] = useState(null);
  const [borrowers, setBorrowers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [selectedLoanId, setSelectedLoanId] = useState(null);
  const [deepLinkBorrowerId, setDeepLinkBorrowerId] = useState(null);
  const [deepLinkLoanId, setDeepLinkLoanId] = useState(null);
  const [editingLoan, setEditingLoan] = useState(null);

  useEffect(() => {
    const savedToken = localStorage.getItem('jwt_token');
    const savedProfile = localStorage.getItem('borrowerProfile');
    const savedUser = localStorage.getItem('user');
    
    if (savedToken) {
      setToken(savedToken);
      setIsLoggedIn(true);
      setProfileCompleted(!!savedProfile);
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
    }
    // Support deep links like ?view=borrower-detail&borrowerId=123 or ?view=loan-detail&loanId=456
    try {
      const params = new URLSearchParams(window.location.search);
      const view = params.get('view');
      const borrowerId = params.get('borrowerId');
      const loanId = params.get('loanId');
      if (view) setCurrentView(view);
      if (borrowerId) setDeepLinkBorrowerId(borrowerId);
      if (loanId) setDeepLinkLoanId(loanId);
    } catch (_) {}
  }, []);

  const handleLogin = (token, userData) => {
    setToken(token);
    setUser(userData);
    setIsLoggedIn(true);
    setProfileCompleted(true); // Skip profile completion for now
  };

  const handleLogout = () => {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('borrowerProfile');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setIsLoggedIn(false);
    setProfileCompleted(false);
    setCurrentView('dashboard');
    setSelectedBorrower(null);
    setBorrowers([]);
  };

  const handleNavigateToProfile = () => {
    setCurrentView('admin-profile');
  };

  const handleCreateNew = () => {
    setCurrentView('create-borrower');
    setSelectedBorrower(null);
  };

  const handleSelectBorrower = (borrower) => {
    setSelectedBorrower(borrower);
    setCurrentView('borrower-detail');
  };

  const handleEdit = (borrower) => {
    setSelectedBorrower(borrower);
    setCurrentView('edit-borrower');
  };

  const handleCreateLoanRequest = () => {
    setCurrentView('loan-requests-create');
  };

  const refreshBorrowers = async () => {
    if (token) {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${process.env.REACT_APP_API_URL}/wp/v2/borrower-profile`, {
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

  const handleBack = () => {
    if (currentView === 'borrower-detail' || currentView === 'edit-borrower') {
      setCurrentView('borrowers');
      setSelectedBorrower(null);
      // Refresh borrowers data when navigating back from edit
      refreshBorrowers();
    } else if (currentView === 'create-borrower') {
      setCurrentView('dashboard');
    }
  };

  // Fetch borrowers when logged in
  useEffect(() => {
    if (isLoggedIn && token) {
      refreshBorrowers();
    }
  }, [isLoggedIn, token]);

  // Apply deep-linked borrower once list is loaded
  useEffect(() => {
    if (deepLinkBorrowerId && borrowers && borrowers.length > 0) {
      const b = borrowers.find(x => String(x.id) === String(deepLinkBorrowerId));
      if (b) {
        setSelectedBorrower(b);
        setCurrentView('borrower-detail');
        setDeepLinkBorrowerId(null);
      }
    }
  }, [deepLinkBorrowerId, borrowers]);

  // Apply deep-linked loan when token present
  useEffect(() => {
    if (deepLinkLoanId) {
      setSelectedLoanId(String(deepLinkLoanId));
      setCurrentView('loan-detail');
      setDeepLinkLoanId(null);
    }
  }, [deepLinkLoanId]);

  // Show login form
  if (!isLoggedIn) {
    return <Login onLoginSuccess={handleLogin} />;
  }

  // Show main dashboard layout
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        <Sidebar 
          currentView={currentView} 
          setCurrentView={(view) => {
            setCurrentView(view);
            // Refresh borrowers when navigating to borrowers list
            if (view === 'borrowers') {
              refreshBorrowers();
            }
          }}
          onCreateNew={handleCreateNew}
        />
        <div className="flex-1 flex flex-col">
          <Header onLogout={handleLogout} user={user} onNavigateToProfile={handleNavigateToProfile} />
          {currentView === 'loans' && (
            <div className="p-6">
              <Loans onCreateNew={handleCreateNew} setCurrentView={setCurrentView} />
            </div>
          )}
          {currentView === 'loans-create' && (
            <div className="p-6">
              <CreateLoan 
                token={token} 
                setCurrentView={(view) => {
                  setEditingLoan(null); // Clear editing loan when navigating away
                  setCurrentView(view);
                }}
                onOpenBorrower={(id) => {
                  const url = `${window.location.origin}?view=borrower-detail&borrowerId=${id}`;
                  window.open(url, '_blank', 'noopener');
                }}
                editingLoan={editingLoan}
              />
            </div>
          )}
          {currentView === 'loans-active' && (
            <div className="p-6">
              <div className="mb-8">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Loans</h1>
                    <p className="text-gray-600">Manage and view loan applications and approvals</p>
                  </div>
                  <button
                    onClick={() => setCurrentView('loans-create')}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 self-start sm:self-center"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span>Create New Loan</span>
                  </button>
                </div>
              </div>
              <LoansActive token={token} setCurrentView={(v) => {
                if (typeof v === 'object' && v.view === 'loan-detail') {
                  setSelectedLoanId(v.loanId);
                  setCurrentView('loan-detail');
                } else {
                  setCurrentView(v);
                }
              }} />
            </div>
          )}
          {currentView === 'loan-detail' && (
            <div className="p-6">
              <LoansDetail 
                token={token} 
                loanId={selectedLoanId} 
                onBack={() => setCurrentView('loans-active')} 
                onOpenBorrower={(id) => {
                  const url = `${window.location.origin}?view=borrower-detail&borrowerId=${id}`;
                  window.open(url, '_blank', 'noopener');
                }}
                onEditLoan={(loan) => {
                  setEditingLoan(loan);
                  setCurrentView('loans-create');
                }}
              />
            </div>
          )}
          {currentView === 'loan-requests' && (
            <div className="p-6">
              <div className="mb-8">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Loan Requests</h1>
                    <p className="text-gray-600">Review and process incoming loan requests</p>
                  </div>
                  <button
                    onClick={handleCreateLoanRequest}
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
                  onClick={handleCreateLoanRequest}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 mx-auto"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Create Loan Request</span>
                </button>
              </div>
            </div>
          )}
          {currentView === 'loan-requests-create' && (
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
          )}
          {currentView === 'loan-calculator' && (
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
          )}
          {currentView === 'loan-products' && (
            <div className="p-6">
              <LoanProducts token={token} />
            </div>
          )}
          {currentView === 'loan-contract' && (
            <div className="p-6">
              <LoanContract />
            </div>
          )}
          {currentView === 'bank-accounts' && (
            <div className="p-6">
              <BankAccounts token={token} setCurrentView={setCurrentView} />
            </div>
          )}
          {currentView === 'notes' && (
            <div className="p-6">
              <Notes token={token} />
            </div>
          )}
          {currentView === 'reports' && (
            <div className="p-6">
              <Reports />
            </div>
          )}
          {currentView === 'settings' && (
            <div className="p-6">
              <Settings />
            </div>
          )}
          {currentView === 'admin-profile' && (
            <AdminProfile user={user} token={token} />
          )}
          {(currentView === 'dashboard' || currentView === 'borrowers' || currentView === 'create-borrower' || currentView === 'borrower-detail' || currentView === 'edit-borrower') && (
            <Dashboard
              currentView={currentView}
              borrowers={borrowers}
              selectedBorrower={selectedBorrower}
              onSelectBorrower={handleSelectBorrower}
              onCreateNew={handleCreateNew}
              onEdit={handleEdit}
              onBack={handleBack}
              loading={loading}
              error={error}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;