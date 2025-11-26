import React, { useState, useEffect } from 'react';
import SuccessMessage from './components/SuccessMessage';

const BankAccounts = ({ token, setCurrentView }) => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [backendReady, setBackendReady] = useState(false);
  const [formData, setFormData] = useState({
    account_type: '',
    bank_name_au: '',
    bank_name_mn: '',
    account_name: '',
    bsb: '',
    account_number: '',
    account_status: true
  });
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState({ show: false, message: '', type: 'success' });
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [editForm, setEditForm] = useState({
    account_status: true
  });
  const [originalForm, setOriginalForm] = useState({
    account_status: true
  });
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [countryFilter, setCountryFilter] = useState('');

  // API base URL with fallback
  const apiBase = (typeof window !== 'undefined' && window.REACT_APP_API_URL) || process.env.REACT_APP_API_URL || `${window.location.origin}/wp-json`;

  // Bank options
  const australianBanks = [
    'Commonwealth Bank of Australia (CBA)',
    'Westpac Banking Corporation',
    'Australia and New Zealand Banking Group (ANZ)',
    'National Australia Bank (NAB)',
    'Macquarie Bank',
    'Bank of Queensland (BOQ)',
    'Bendigo and Adelaide Bank',
    'Suncorp Bank',
    'ING Bank (Australia)',
    'AMP Bank',
    'Bankwest',
    'ME Bank (Members Equity Bank)',
    'UBank',
    'HSBC Bank Australia',
    'Rabobank Australia',
    'Bank Australia',
    'Heritage Bank',
    'Beyond Bank Australia',
    'People\'s Choice Credit Union',
    'Defence Bank',
    'Teachers Mutual Bank',
    'Police Bank',
    'Newcastle Permanent Bank',
    'Greater Bank'
  ];

  const mongolianBanks = [
    'Khan Bank',
    'Trade and Development Bank',
    'Golomt Bank',
    'XacBank',
    'State Bank',
    'Ard Bank',
    'Capitron Bank',
    'Bogd Bank',
    'TransBank',
    'Tenger Bank',
    'National Investment Bank',
    'Chingis Khaan Bank',
    'Arig Bank',
    'Credit Bank',
    'Development Bank of Mongolia'
  ];

  // Fetch bank accounts
  const fetchAccounts = async () => {
    if (!token) return;
    
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${apiBase}/wp/v2/bank-account-system?status=publish,draft&per_page=100`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch bank accounts: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      setAccounts(data);
      setBackendReady(true);
    } catch (err) {
      console.error('Error fetching bank accounts:', err);
      setError(`Failed to load bank accounts: ${err.message}`);
      setAccounts([]);
      setBackendReady(false);
    } finally {
      setLoading(false);
    }
  };

  // Create new bank account
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) return;

    setSubmitting(true);
    setError('');
    setSuccessMessage({ show: false, message: '', type: 'success' });
    
    try {
      // Prepare the data for the API
      const accountData = {
        title: formData.account_name,
        status: formData.account_status ? 'publish' : 'draft',
        account_type: formData.account_type,
        bank_name_au: formData.bank_name_au || '',
        bank_name_mn: formData.bank_name_mn || '',
        account_name: formData.account_name,
        bsb: formData.bsb || '',
        account_number: formData.account_number,
        account_status: formData.account_status ? 'Active' : 'Inactive'
      };

      const response = await fetch(`${apiBase}/wp/v2/bank-account-system`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(accountData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to create bank account: ${response.status} ${response.statusText}`);
      }

      const newAccount = await response.json();
      
      // Add the new account to the list
      setAccounts(prev => [...prev, newAccount]);
      
      // Show success message
      setSuccessMessage({ show: true, message: 'Bank account created successfully!', type: 'success' });
      
      // Reset form and close
      setFormData({
        account_type: '',
        bank_name_au: '',
        bank_name_mn: '',
        account_name: '',
        bsb: '',
        account_number: '',
        account_status: true
      });
      setShowCreateForm(false);
      
    } catch (err) {
      console.error('Error creating bank account:', err);
      setError(`Failed to create bank account: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Edit account handlers
  const handleEditAccount = (account) => {
    setSelectedAccount(account);
    
    // Handle account_status from API response
    let accountStatus = account.account_status;
    if (Array.isArray(accountStatus)) {
      accountStatus = accountStatus[0];
    }
    const isActive = accountStatus === true || accountStatus === 'Active' || accountStatus === 'active';
    
    const initialForm = {
      account_status: isActive
    };
    setEditForm(initialForm);
    setOriginalForm(initialForm);
    setShowEditModal(true);
  };

  const handleUpdateAccount = async () => {
    if (!token || !selectedAccount) return;
    setSubmitting(true);
    setError('');
    try {
      const updateData = {
        status: editForm.account_status ? 'publish' : 'draft',
        account_status: editForm.account_status ? 'Active' : 'Inactive'
      };
      
      const response = await fetch(`${apiBase}/wp/v2/bank-account-system/${selectedAccount.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to update bank account: ${response.status} ${response.statusText}`);
      }
      
      setSuccessMessage({ show: true, message: 'Bank account updated successfully!', type: 'success' });
      
      // Update the selected account state immediately
      setSelectedAccount(prev => ({ 
        ...prev, 
        account_status: editForm.account_status 
      }));
      
      // Also update the accounts list immediately
      setAccounts(prev => prev.map(a => 
        a.id === selectedAccount.id 
          ? { 
              ...a, 
              account_status: editForm.account_status 
            }
          : a
      ));
      
      // Close the modal after successful update
      setShowEditModal(false);
      
      // Refresh from server to confirm
      fetchAccounts();
    } catch (err) {
      console.error('Bank account update error:', err);
      setError(`Failed to update bank account: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const hasChanges = () => {
    return editForm.account_status !== originalForm.account_status;
  };

  const handleCancelEdit = () => {
    if (hasChanges()) {
      setShowConfirmModal(true);
    } else {
      setShowEditModal(false);
    }
  };

  const handleConfirmCancel = () => {
    setShowEditModal(false);
    setShowConfirmModal(false);
  };

  const handleConfirmSave = () => {
    setShowConfirmModal(false);
    handleUpdateAccount();
  };

  // Filter accounts based on search term and country
  const filteredAccounts = accounts ? accounts.filter(account => {
    try {
      // Check if search term matches (case-insensitive)
      let matchesSearch = true;
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        matchesSearch = 
          (account.account_name && String(account.account_name).toLowerCase().includes(searchLower)) ||
          (account.title && String(account.title.rendered || account.title).toLowerCase().includes(searchLower)) ||
          (account.bank_name_au && String(account.bank_name_au).toLowerCase().includes(searchLower)) ||
          (account.bank_name_mn && String(account.bank_name_mn).toLowerCase().includes(searchLower)) ||
          (account.account_number && String(account.account_number).includes(searchTerm)) ||
          (account.bsb && String(account.bsb).includes(searchTerm));
      }
      
      // Check if country filter matches
      let matchesCountry = true;
      if (countryFilter) {
        const accountType = Array.isArray(account.account_type) ? account.account_type[0] : account.account_type;
        matchesCountry = accountType === countryFilter;
      }
      
      return matchesSearch && matchesCountry;
    } catch (error) {
      console.error('Error filtering account:', error, account);
      return true; // Include account if there's an error
    }
  }) : [];

  useEffect(() => {
    fetchAccounts();
  }, [token]);

  if (showCreateForm) {
    return (
      <div>
        {/* Header Section */}
        <div className="mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Add New Bank Account</h1>
            <p className="text-gray-600">Enter bank account details</p>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Account Type */}
              <div>
                <label htmlFor="account_type" className="block text-sm font-medium text-gray-700 mb-2">
                  Account Type *
                </label>
                <select
                  id="account_type"
                  name="account_type"
                  value={formData.account_type}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select Country</option>
                  <option value="Australia">Australia</option>
                  <option value="Mongolia">Mongolia</option>
                </select>
              </div>

              {/* Bank Name */}
              <div>
                <label htmlFor="bank_name" className="block text-sm font-medium text-gray-700 mb-2">
                  Bank Name *
                </label>
                <select
                  id="bank_name"
                  name={formData.account_type === 'Australia' ? 'bank_name_au' : 'bank_name_mn'}
                  value={formData.account_type === 'Australia' ? formData.bank_name_au : formData.bank_name_mn}
                  onChange={handleInputChange}
                  required
                  disabled={!formData.account_type}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                >
                  <option value="">Select Bank</option>
                  {formData.account_type === 'Australia' && australianBanks.map(bank => (
                    <option key={bank} value={bank}>{bank}</option>
                  ))}
                  {formData.account_type === 'Mongolia' && mongolianBanks.map(bank => (
                    <option key={bank} value={bank}>{bank}</option>
                  ))}
                </select>
              </div>

              {/* Account Name */}
              <div>
                <label htmlFor="account_name" className="block text-sm font-medium text-gray-700 mb-2">
                  Account Name *
                </label>
                <input
                  type="text"
                  id="account_name"
                  name="account_name"
                  value={formData.account_name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter account holder name"
                />
              </div>

              {/* BSB (only for Australia) */}
              {formData.account_type === 'Australia' && (
                <div>
                  <label htmlFor="bsb" className="block text-sm font-medium text-gray-700 mb-2">
                    BSB *
                  </label>
                  <input
                    type="text"
                    id="bsb"
                    name="bsb"
                    value={formData.bsb}
                    onChange={handleInputChange}
                    required
                    pattern="[0-9]{6}"
                    maxLength="6"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="123456"
                  />
                </div>
              )}

              {/* Account Number */}
              <div>
                <label htmlFor="account_number" className="block text-sm font-medium text-gray-700 mb-2">
                  Account Number *
                </label>
                <input
                  type="number"
                  id="account_number"
                  name="account_number"
                  value={formData.account_number}
                  onChange={handleInputChange}
                  required
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter account number"
                />
              </div>

              {/* Account Status */}
              <div className="md:col-span-2">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, account_status: !formData.account_status})}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${formData.account_status ? 'bg-green-500 focus:ring-green-300' : 'bg-gray-300 focus:ring-gray-300'}`}
                    aria-pressed={formData.account_status}
                    aria-label="Toggle account status"
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${formData.account_status ? 'translate-x-6' : 'translate-x-1'}`}></span>
                  </button>
                  <span className={`text-sm ${formData.account_status ? 'text-green-700' : 'text-gray-700'}`}>
                    {formData.account_status ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Toggle to activate or deactivate this bank account</p>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {submitting && (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                <span>
                  {submitting 
                    ? 'Creating...' 
                    : 'Create Account'
                  }
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Add error boundary for the entire component
  try {
    return (
      <div>
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Bank Accounts</h1>
            <p className="text-gray-600">Manage and view bank accounts and financial information</p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 self-start sm:self-center"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>Add New Account</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Section */}
      <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Search Field */}
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
              Search Accounts
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                id="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Search by account name, bank, account number, or BSB..."
              />
            </div>
          </div>

          {/* Country Filter */}
          <div>
            <label htmlFor="countryFilter" className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Country
            </label>
            <select
              id="countryFilter"
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Countries</option>
              <option value="Australia">Australia</option>
              <option value="Mongolia">Mongolia</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="animate-spin h-12 w-12 text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Loading accounts...</h3>
          <p className="text-gray-500">Please wait while we fetch your bank accounts.</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && accounts.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No accounts found</h3>
          <p className="text-gray-500 mb-8 max-w-md mx-auto">Get started by adding your first bank account. This will help you manage financial information and track transactions.</p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 mx-auto"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>Add First Account</span>
          </button>
        </div>
      )}

      {/* No Filter Results */}
      {!loading && accounts.length > 0 && filteredAccounts.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No matching accounts</h3>
          <p className="text-gray-500 mb-4">No accounts match your current search criteria.</p>
          <p className="text-sm text-gray-400 mb-6">Try adjusting your search term or country filter.</p>
          <button
            onClick={() => {
              setSearchTerm('');
              setCountryFilter('');
            }}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium"
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* Accounts Table */}
      {!loading && filteredAccounts.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Account Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Country
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bank
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Account Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    BSB
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAccounts.map((account, index) => {
                  // Handle account_status from API response
                  let accountStatus = account.account_status;
                  if (Array.isArray(accountStatus)) {
                    accountStatus = accountStatus[0];
                  }
                  const isActive = accountStatus === true || accountStatus === 'Active' || accountStatus === 'active';
                  
                  return (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {account.account_name || account.title}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {Array.isArray(account.account_type) ? account.account_type[0] : account.account_type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {(Array.isArray(account.account_type) ? account.account_type[0] : account.account_type) === 'Australia' 
                          ? (Array.isArray(account.bank_name_au) ? account.bank_name_au[0] : account.bank_name_au)
                          : (Array.isArray(account.bank_name_mn) ? account.bank_name_mn[0] : account.bank_name_mn)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {account.account_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {account.bsb || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          isActive 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <button
                          onClick={() => handleEditAccount(account)}
                          className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                          title="View/Edit Account"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedAccount && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Bank Account Details</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Account Name</label>
                  <p className="text-sm text-gray-900">{selectedAccount.account_name || selectedAccount.title}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Country</label>
                  <p className="text-sm text-gray-900">{Array.isArray(selectedAccount.account_type) ? selectedAccount.account_type[0] : selectedAccount.account_type}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Bank</label>
                  <p className="text-sm text-gray-900">
                    {(Array.isArray(selectedAccount.account_type) ? selectedAccount.account_type[0] : selectedAccount.account_type) === 'Australia' 
                      ? (Array.isArray(selectedAccount.bank_name_au) ? selectedAccount.bank_name_au[0] : selectedAccount.bank_name_au)
                      : (Array.isArray(selectedAccount.bank_name_mn) ? selectedAccount.bank_name_mn[0] : selectedAccount.bank_name_mn)}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Account Number</label>
                  <p className="text-sm text-gray-900">{selectedAccount.account_number}</p>
                </div>
                {selectedAccount.bsb && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">BSB</label>
                    <p className="text-sm text-gray-900">{selectedAccount.bsb}</p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Account Status</label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setEditForm({...editForm, account_status: !editForm.account_status})}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${editForm.account_status ? 'bg-green-500 focus:ring-green-300' : 'bg-gray-300 focus:ring-gray-300'}`}
                      aria-pressed={editForm.account_status}
                      aria-label="Toggle account status"
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${editForm.account_status ? 'translate-x-6' : 'translate-x-1'}`}></span>
                    </button>
                    <span className={`text-sm ${editForm.account_status ? 'text-green-700' : 'text-gray-700'}`}>
                      {editForm.account_status ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={handleCancelEdit}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateAccount}
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Updating...' : 'Update Account'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100">
                <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="mt-2 text-center">
                <h3 className="text-lg font-medium text-gray-900">Unsaved Changes</h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    You have unsaved changes. Do you want to save them before closing?
                  </p>
                </div>
              </div>
              <div className="flex justify-center gap-3 mt-6">
                <button
                  onClick={handleConfirmCancel}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                >
                  Discard Changes
                </button>
                <button
                  onClick={handleConfirmSave}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Message */}
      <SuccessMessage
        isVisible={successMessage.show}
        onClose={() => setSuccessMessage({ show: false, message: '', type: 'success' })}
        message={successMessage.message}
        type={successMessage.type}
      />
    </div>
  );
  } catch (error) {
    console.error('BankAccounts component error:', error);
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-md w-full">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Bank Accounts</h3>
            <p className="text-gray-500 mb-4">There was an error loading the bank accounts page.</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
            >
              Reload Page
            </button>
          </div>
        </div>
      </div>
    );
  }
};

export default BankAccounts;
