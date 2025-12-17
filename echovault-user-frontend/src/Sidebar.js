import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const APP_VERSION = '1.1.2';

const Sidebar = ({ currentView }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/' || location.pathname === '/dashboard';
    return location.pathname.startsWith(path);
  };

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z', path: '/' },
    { id: 'loans', label: 'Loans', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16', path: '/loans' },
    { id: 'products', label: 'Loan Products', icon: 'M19 11H5m14 0a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2m14 0V9a2 2 0 0 0-2-2M5 11V9a2 2 0 0 1 2-2m0 0V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2M7 7h10', path: '/products' },
    { id: 'news', label: 'News', icon: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z', path: '/news' },
    { id: 'profile', label: 'Profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', path: '/profile' }
  ];

  return (
    <div className={`${sidebarCollapsed ? 'w-16' : 'w-64'} bg-white shadow-sm border-r border-gray-200 min-h-screen flex flex-col transition-all duration-300`}>
      <div className={`${sidebarCollapsed ? 'p-2' : 'p-6'} flex-1`}>
        <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} mb-8`}>
          {!sidebarCollapsed && (
            <img 
              src="/Logo/echologo.png" 
              alt="EchoVault" 
              className="h-8 w-auto"
            />
          )}
          {sidebarCollapsed && (
            <div className="flex flex-col items-center space-y-2">
              <button
                onClick={toggleSidebar}
                className="p-2 hover:bg-gray-100 rounded-md transition-colors duration-200 group relative"
                title="Expand sidebar"
              >
                <img 
                  src="/Logo/echologo_short.png" 
                  alt="EchoVault" 
                  className="h-8 w-auto"
                />
                <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                  Expand sidebar
                </div>
              </button>
            </div>
          )}
          {!sidebarCollapsed && (
            <button
              onClick={toggleSidebar}
              className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors duration-200"
              title="Collapse sidebar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
        </div>

        <nav className="space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-1 group relative' : 'px-3'} py-2 text-sm font-medium rounded-lg transition-colors ${
                isActive(item.path)
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
              title={sidebarCollapsed ? item.label : ''}
            >
              <svg className={`w-5 h-5 ${sidebarCollapsed ? '' : 'mr-3'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
              </svg>
              {!sidebarCollapsed && <span>{item.label}</span>}
              {sidebarCollapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                  {item.label}
                </div>
              )}
            </button>
          ))}
        </nav>
      </div>
      
      {/* Copyright Footer */}
      {!sidebarCollapsed && (
        <div className="p-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            © 2025 EchoVault LMS. Developed by{' '}
            <a 
              href="https://simplesmart.com.au/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 hover:underline transition-colors duration-200"
            >
              SimpleSmart
            </a>
          </p>
          <p className="text-xs text-gray-400 text-center mt-1">
            Version {APP_VERSION}
          </p>
        </div>
      )}
    </div>
  );
};

export default Sidebar;

