import React, { useState, useEffect } from 'react';
import Login from './Login';
import Sidebar from './Sidebar';
import Header from './Header';
import Dashboard from './Dashboard';
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

  // Show login form
  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
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
          <Header onLogout={handleLogout} user={user} />
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
        </div>
      </div>
    </div>
  );
}

export default App;