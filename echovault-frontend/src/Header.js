import React from 'react';

const Header = ({ onLogout, user }) => {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200 h-16">
      <div className="flex items-center justify-between h-full px-6">
        <div className="flex items-center">
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white font-medium text-sm">
                {user?.username ? user.username.charAt(0).toUpperCase() : 'U'}
              </span>
            </div>
            <div className="text-sm">
              <p className="font-medium text-gray-900">
                {user?.username || 'User'}
              </p>
              <p className="text-gray-500">Administrator</p>
            </div>
          </div>
          
          <button
            onClick={onLogout}
            className="text-gray-500 hover:text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-100 border border-gray-300 hover:border-gray-400 flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
