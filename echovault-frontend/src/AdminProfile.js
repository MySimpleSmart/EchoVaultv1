import React, { useState, useEffect } from 'react';

const AdminProfile = ({ user, token }) => {
  const [profile, setProfile] = useState({
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    department: 'Administration',
    role: 'Administrator',
    lastLogin: '',
    accountCreated: ''
  });

  useEffect(() => {
    console.log('AdminProfile received user:', user);
    if (user) {
      setProfile(prev => ({
        ...prev,
        username: user.username || '',
        email: user.user_email || user.email || '', // Show exact email from user object
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phone: user.phone || '',
        lastLogin: user.lastLogin || new Date().toLocaleDateString(),
        accountCreated: user.accountCreated || new Date().toLocaleDateString()
      }));
      console.log('AdminProfile set profile with email:', user.user_email || user.email || '');
    }
  }, [user]);

  // Fallback: fetch admin details when missing and we have a token
  useEffect(() => {
    const fetchEmailIfMissing = async () => {
      try {
        if (token && (!profile.email || !profile.firstName || !profile.lastName)) {
          // Prefer WordPress admin email from settings
          try {
            const apiBase = (typeof window !== 'undefined' && window.REACT_APP_API_URL) || process.env.REACT_APP_API_URL || `${window.location.origin}/wp-json`;
            const settingsResp = await fetch(`${apiBase}/wp/v2/settings`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              mode: 'cors'
            });
            if (settingsResp.ok) {
              const settings = await settingsResp.json();
              const adminEmail = settings?.email || settings?.admin_email || '';
              if (adminEmail) {
                setProfile(prev => ({ ...prev, email: adminEmail }));
                // Fetch the authenticated admin user's profile with edit context to access names
                try {
                  const meResp = await fetch(`${apiBase}/wp/v2/users/me?context=edit`, {
                    method: 'GET',
                    headers: {
                      'Authorization': `Bearer ${token}`,
                      'Content-Type': 'application/json'
                    },
                    mode: 'cors'
                  });
                  if (meResp.ok) {
                    const me = await meResp.json();
                    const firstName = me.first_name || me.firstName || '';
                    const lastName = me.last_name || me.lastName || '';
                    setProfile(prev => ({ 
                      ...prev, 
                      firstName: firstName,
                      lastName: lastName
                    }));
                  }
                } catch (_) { /* ignore user fetch issues */ }
              }
            }
          } catch (_) { /* ignore settings fetch issues */ }

          // Step 0: Try to decode the JWT locally for an email claim
          try {
            const parts = String(token).split('.');
            if (parts.length === 3) {
              const payloadJson = JSON.parse(atob(parts[1]));
              const jwtEmail = payloadJson?.data?.user?.user_email 
                || payloadJson?.data?.user_email 
                || payloadJson?.user_email 
                || payloadJson?.email 
                || '';
              if (jwtEmail) {
                setProfile(prev => ({ ...prev, email: jwtEmail }));
                try {
                  const stored = localStorage.getItem('user');
                  if (stored) {
                    const parsed = JSON.parse(stored);
                    const updated = { ...parsed, user_email: jwtEmail, email: jwtEmail };
                    localStorage.setItem('user', JSON.stringify(updated));
                  }
                } catch (_) {}
                return; // Email resolved from JWT, stop here
              }
            }
          } catch (_) { /* ignore */ }

          const apiBase = (typeof window !== 'undefined' && window.REACT_APP_API_URL) || process.env.REACT_APP_API_URL || `${window.location.origin}/wp-json`;
          const response = await fetch(`${apiBase}/wp/v2/users/me?context=edit`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            mode: 'cors'
          });

          if (response.ok) {
            const userProfile = await response.json();
            const fetchedEmail = userProfile.email || userProfile.user_email || '';
            const firstName = userProfile.first_name || userProfile.firstName || '';
            const lastName = userProfile.last_name || userProfile.lastName || '';
            
            setProfile(prev => ({ 
              ...prev, 
              email: fetchedEmail || prev.email,
              firstName: firstName,
              lastName: lastName
            }));
            
            // Also update localStorage user for future sessions
            try {
              const stored = localStorage.getItem('user');
              if (stored) {
                const parsed = JSON.parse(stored);
                const updated = { 
                  ...parsed, 
                  user_email: fetchedEmail || parsed.user_email, 
                  email: fetchedEmail || parsed.email,
                  firstName: firstName,
                  lastName: lastName
                };
                localStorage.setItem('user', JSON.stringify(updated));
              }
            } catch (_) {
              // ignore storage errors
            }
          } else {
            // Fallback: validate token and try to read email-like fields
            const validateResp = await fetch(`${apiBase}/jwt-auth/v1/token/validate`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              mode: 'cors'
            });
            if (validateResp.ok) {
              const tokenData = await validateResp.json();
              const tokenEmail = tokenData?.data?.user_email || tokenData?.user_email || '';
              if (tokenEmail) {
                setProfile(prev => ({ ...prev, email: tokenEmail }));
              }
            }
          }
        }
      } catch (e) {
        // ignore network errors here; UI can function without email
      }
    };

    fetchEmailIfMissing();
  }, [profile.email, token]);


  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-md">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden">
              <img 
                src="/avatars/monster (1).svg" 
                alt="Admin Avatar" 
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Profile</h1>
              <p className="text-gray-600 mt-1">View your administrator account details</p>
            </div>
          </div>
        </div>

        {/* Profile Content */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Personal Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                Personal Information
              </h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={profile.username}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                />
                
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={profile.email}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                />
                
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  value={profile.firstName}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  value={profile.lastName}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                />
              </div>

            </div>

            {/* Account Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                Account Information
              </h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department
                </label>
                <input
                  type="text"
                  value={profile.department}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <input
                  type="text"
                  value={profile.role}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Login
                </label>
                <input
                  type="text"
                  value={profile.lastLogin}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account Created
                </label>
                <input
                  type="text"
                  value={profile.accountCreated}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                />
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminProfile;
