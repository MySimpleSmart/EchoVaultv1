import React, { useState, useEffect } from 'react';
import './Login.css';

const Login = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const savedUsername = localStorage.getItem('saved_username');
    const savedPassword = localStorage.getItem('saved_password');
    const savedRememberMe = localStorage.getItem('remember_me') === 'true';
    
    if (savedRememberMe && savedUsername) {
      setUsername(savedUsername);
      setPassword(savedPassword || '');
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const apiBase = (typeof window !== 'undefined' && window.REACT_APP_API_URL) || process.env.REACT_APP_API_URL || `${window.location.origin}/wp-json`;
      const response = await fetch(`${apiBase}/jwt-auth/v1/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          password,
        }),
        mode: 'cors'
      });

      const data = await response.json();

      if (response.ok && data.token) {
        localStorage.setItem('jwt_token', data.token);

        let userEmail = data.user_email || data.email || '';
        try {
          const parts = String(data.token).split('.');
          if (parts.length === 3) {
            const payloadJson = JSON.parse(atob(parts[1]));
            const jwtEmail = payloadJson?.data?.user?.user_email 
              || payloadJson?.data?.user_email 
              || payloadJson?.user_email 
              || payloadJson?.email;
            if (jwtEmail) userEmail = jwtEmail;
          }
        } catch (_) {}
        
        try {
          const tokenResponse = await fetch(`${apiBase}/jwt-auth/v1/token/validate`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${data.token}`,
              'Content-Type': 'application/json'
            },
            mode: 'cors'
          });
          
          if (tokenResponse.ok) {
            const tokenData = await tokenResponse.json();
            const tokenEmail = tokenData.data?.user_email || tokenData.user_email || '';
            if (tokenEmail) userEmail = tokenEmail;
          }
        } catch (_) {}
        
        if (!userEmail) {
          try {
            const userResponse = await fetch(`${apiBase}/wp/v2/users/me`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${data.token}`,
                'Content-Type': 'application/json'
              },
              mode: 'cors'
            });
            
            if (userResponse.ok) {
              const userProfile = await userResponse.json();
              const profileEmail = userProfile.email || userProfile.user_email || '';
              if (profileEmail) userEmail = profileEmail;
          }
          } catch (_) {}
        }

        const userData = { 
          username: username, 
          user_email: userEmail,
          email: userEmail
        };
        localStorage.setItem('user', JSON.stringify(userData));
        
        if (rememberMe) {
          localStorage.setItem('saved_username', username);
          localStorage.setItem('saved_password', password);
          localStorage.setItem('remember_me', 'true');
        } else {
          localStorage.removeItem('saved_username');
          localStorage.removeItem('saved_password');
          localStorage.removeItem('remember_me');
        }

        onLoginSuccess(data.token, userData);
      } else {
        setError(data.message || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="text-center mb-8">
            <img
              src="/Logo/echologo.png"
              alt="EchoVault"
              className="mx-auto mb-4 h-12 w-auto"
            />
            <p className="text-gray-600 text-sm">Loan Management System</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
              <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
              />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  disabled={loading}
                >
                  {showPassword ? (
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={loading}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded focus:ring-2 focus:ring-blue-200 transition-colors duration-200"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700 font-medium cursor-pointer select-none">
                  Remember me
                </label>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md font-medium hover:bg-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-center">
            <a
              href="https://simplesmart.com.au/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              by SimpleSmart
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
