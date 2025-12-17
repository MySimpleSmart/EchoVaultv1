import React, { useState, useRef, useEffect } from 'react';

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

const Header = ({ onLogout, user, profile }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const dropdownRef = useRef(null);
  const notificationRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setIsNotificationOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogoutClick = () => {
    setIsDropdownOpen(false);
    onLogout();
  };

  const handleNotificationClick = () => {
    setIsNotificationOpen(!isNotificationOpen);
    setIsDropdownOpen(false);
  };

  const handleHelpClick = () => {
    alert('Help feature coming soon!');
  };

  const handleTerminalClick = () => {
    alert('Terminal feature coming soon!');
  };

  const handleThemeToggle = () => {
    setIsDarkMode(!isDarkMode);
    alert(`Switching to ${!isDarkMode ? 'Dark' : 'Light'} mode!`);
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 h-16">
      <div className="flex items-center justify-between h-full px-6">
        <div className="flex items-center">
        </div>
        
        <div className="flex items-center">
          <div className="flex items-center space-x-2 mr-6">
            <button
              onClick={handleTerminalClick}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors duration-200"
              title="Terminal"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>

            <button
              onClick={handleHelpClick}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors duration-200"
              title="Help"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </button>

            <div className="relative" ref={notificationRef}>
              <button
                onClick={handleNotificationClick}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors duration-200 relative"
                title="Notifications"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-red-500 rounded-full"></span>
              </button>

              {isNotificationOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <h3 className="text-sm font-medium text-gray-900">Notifications</h3>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    <div className="px-4 py-3 hover:bg-gray-50 border-b border-gray-100">
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900">No new notifications</p>
                          <p className="text-xs text-gray-500 mt-1">You're all caught up!</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleThemeToggle}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors duration-200 mr-4"
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDarkMode ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-100 transition-colors duration-200"
            >
              <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100">
                {profile ? (
                  <img
                    src={getAvatarByBorrowerId(profile)}
                    alt={profile.first_name || "User Avatar"}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      const fallback = e.target.nextSibling;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div 
                  className="w-full h-full bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xs"
                  style={{ display: profile ? 'none' : 'flex' }}
                >
                  {profile?.first_name?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || 'C'}
                </div>
              </div>
              <div className="text-sm text-left">
                <p className="font-medium text-gray-900">
                  {profile?.first_name || user?.username || 'Client'}
                </p>
                <p className="text-gray-500">Client</p>
              </div>
              <svg 
                className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    window.location.href = '/profile';
                  }}
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-200"
                >
                  <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Profile
                </button>
                <div className="border-t border-gray-100 my-1"></div>
                <button
                  onClick={handleLogoutClick}
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-200"
                >
                  <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;

