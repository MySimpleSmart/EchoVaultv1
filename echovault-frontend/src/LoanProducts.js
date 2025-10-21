import React, { useEffect, useState } from 'react';
import SuccessMessage from './components/SuccessMessage';

const LoanProducts = ({ token }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [editForm, setEditForm] = useState({
    product_description: '',
    product_status: 'Active'
  });
  const [originalForm, setOriginalForm] = useState({
    product_description: '',
    product_status: 'Active'
  });
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState({ show: false, message: '', type: 'success' });
  const [form, setForm] = useState({
    product_id: '',
    product_name: '',
    product_description: '',
    interest_rate: '',
    term_min: '',
    term_max: '',
    currency: 'AUD',
    min_amount: '',
    max_amount: '',
    product_status: 'Active'
  });

  const apiBase = (typeof window !== 'undefined' && window.REACT_APP_API_URL) || process.env.REACT_APP_API_URL || `${window.location.origin}/wp-json`;

  const mapProduct = (raw) => {
    // Get the actual product_status from the custom field
    let productStatus = raw.product_status;
    
    // Handle case where product_status is an array (Pods sometimes returns arrays)
    if (Array.isArray(productStatus)) {
      productStatus = productStatus[0] || '';
    }
    
    // If product_status is empty or undefined, fall back to WordPress post status
    if (!productStatus || productStatus === '') {
      productStatus = raw.status === 'publish' ? 'Active' : 'Inactive';
    }
    
    return {
      id: raw.id,
      product_id: raw.product_id ?? '',
      product_name: raw.product_name ?? (raw.title?.rendered ?? ''),
      product_description: raw.product_description ?? (raw.content?.rendered ?? ''),
      interest_rate: raw.interest_rate ?? '',
      term_min: raw.term_min ?? '',
      term_max: raw.term_max ?? '',
      currency: raw.currency ?? 'AUD',
      min_amount: raw.min_amount ?? '',
      max_amount: raw.max_amount ?? '',
      product_status: productStatus,
      date: raw.date
    };
  };

  const fetchProductDetails = async (id) => {
    // Try Pods single endpoint first
    try {
      const podsResp = await fetch(`${apiBase}/pods/v1/loan-product/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        mode: 'cors'
      });
      if (podsResp.ok) {
        const podsData = await podsResp.json();
        return mapProduct({ id: podsData.ID, date: podsData.post_date, status: podsData.post_status, ...podsData.fields });
      }
    } catch (_) {}
    // Fallback to wp/v2 with context=edit to expose meta/fields
    const wpResp = await fetch(`${apiBase}/wp/v2/loan-product/${id}?context=edit`, {
      headers: { 'Authorization': `Bearer ${token}` },
      mode: 'cors'
    });
    if (wpResp.ok) {
      const wpData = await wpResp.json();
      return mapProduct(wpData);
    }
    return null;
  };

  const generateNextProductId = (list) => {
    const prefix = 'LP';
    const width = 6;
    let maxNum = 0;
    list.forEach(item => {
      const pid = String(item.product_id || '').trim();
      const match = pid.match(/^LP(\d{1,})$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!Number.isNaN(num) && num > maxNum) maxNum = num;
      }
    });
    const next = maxNum + 1;
    const padded = String(next).padStart(width, '0');
    return `${prefix}${padded}`;
  };

  const fetchProducts = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const resp = await fetch(`${apiBase}/wp/v2/loan-product?per_page=100&context=edit&status=publish,draft`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        mode: 'cors'
      });
      if (!resp.ok) throw new Error('Failed to fetch loan products');
      const data = await resp.json();
      const mapped = data.map(item => mapProduct(item));
      setProducts(mapped);
    } catch (e) {
      setError('Could not load loan products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleCreateNew = () => {
    const autoId = generateNextProductId(products);
    setForm(prev => ({
      ...prev,
      product_id: autoId
    }));
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const numeric = (v) => v === '' ? '' : Number(v);
      const body = {
        title: form.product_name,
        content: form.product_description,
        status: form.product_status === 'Active' ? 'publish' : 'draft',
        meta: {
          product_id: form.product_id,
          product_name: form.product_name,
          product_description: form.product_description,
          interest_rate: numeric(form.interest_rate),
          term_min: numeric(form.term_min),
          term_max: numeric(form.term_max),
          currency: form.currency,
          min_amount: numeric(form.min_amount),
          max_amount: numeric(form.max_amount),
          product_status: form.product_status
        }
      };
      // Create via wp/v2 with top-level fields exposed by Pods
      const resp = await fetch(`${apiBase}/wp/v2/loan-product`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: form.product_name,
          content: form.product_description,
          status: form.product_status === 'Active' ? 'publish' : 'draft',
          product_id: form.product_id,
          product_name: form.product_name,
          product_description: form.product_description,
          interest_rate: numeric(form.interest_rate),
          term_min: numeric(form.term_min),
          term_max: numeric(form.term_max),
          currency: form.currency,
          min_amount: numeric(form.min_amount),
          max_amount: numeric(form.max_amount),
          product_status: form.product_status
        }),
        mode: 'cors'
      });
      
      if (!resp.ok) throw new Error('Failed to create product');
      setSuccessMessage({ show: true, message: 'Loan product created successfully!', type: 'success' });
      setShowForm(false);
      setForm({
        product_id: '', product_name: '', product_description: '', interest_rate: '', term_min: '', term_max: '', currency: 'AUD', min_amount: '', max_amount: '', product_status: 'Active'
      });
      fetchProducts();
    } catch (e) {
      setError('Could not create product');
    } finally {
      setLoading(false);
    }
  };

  const getCurrencySymbol = (c) => (c === 'MNT' ? '₮' : '$');

  const handleEditProduct = (product) => {
    setSelectedProduct(product);
    const initialForm = {
      product_description: product.product_description || '',
      product_status: product.product_status || 'Active'
    };
    setEditForm(initialForm);
    setOriginalForm(initialForm);
    setShowEditModal(true);
  };

  const handleUpdateProduct = async () => {
    if (!token || !selectedProduct) return;
    setLoading(true);
    setError('');
    try {
      const updateData = {
        content: editForm.product_description,
        status: editForm.product_status === 'Active' ? 'publish' : 'draft',
        product_description: editForm.product_description,
        product_status: editForm.product_status
      };
      
      const resp = await fetch(`${apiBase}/wp/v2/loan-product/${selectedProduct.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData),
        mode: 'cors'
      });
      
      if (!resp.ok) {
        const errorText = await resp.text();
        console.error('Update failed:', errorText);
        throw new Error('Failed to update product');
      }
      
      setSuccessMessage({ show: true, message: 'Product updated successfully!', type: 'success' });
      
      // Update the selected product state immediately
      setSelectedProduct(prev => ({ 
        ...prev, 
        product_description: editForm.product_description,
        product_status: editForm.product_status 
      }));
      
      // Also update the products list immediately
      setProducts(prev => prev.map(p => 
        p.id === selectedProduct.id 
          ? { 
              ...p, 
              product_description: editForm.product_description,
              product_status: editForm.product_status 
            }
          : p
      ));
      
      // Close the modal after successful update
      setShowEditModal(false);
      
      // Refresh from server to confirm
      fetchProducts();
    } catch (e) {
      console.error('Product update error:', e);
      setError('Could not update product');
    } finally {
      setLoading(false);
    }
  };

  const hasChanges = () => {
    return editForm.product_description !== originalForm.product_description ||
           editForm.product_status !== originalForm.product_status;
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
    handleUpdateProduct();
  };

  if (showForm) {
    return (
      <div>
        {/* Header Section */}
        <div className="mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Create Loan Product</h1>
            <p className="text-gray-600">Add a new loan product to your system</p>
          </div>
        </div>

        {/* Create Form */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Product ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Product ID</label>
              <input
                type="text"
                value={form.product_id}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
              />
            </div>
            {/* Product Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
              <input
                type="text"
                value={form.product_name}
                onChange={(e)=>setForm({...form, product_name:e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>
            {/* Interest Rate */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Interest Rate (%)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.interest_rate}
                onChange={(e)=>setForm({...form, interest_rate:e.target.value})}
                placeholder="e.g. 12.5"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            {/* Term Min */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Term (months)</label>
              <input
                type="number"
                step="1"
                min="1"
                value={form.term_min}
                onChange={(e)=>setForm({...form, term_min:e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            {/* Term Max */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Maximum Term (months)</label>
              <input
                type="number"
                step="1"
                min={form.term_min || 1}
                value={form.term_max}
                onChange={(e)=>setForm({...form, term_max:e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            {/* Currency - moved before amounts */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <select
                value={form.currency}
                onChange={(e)=>setForm({...form, currency: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="AUD">AUD</option>
                <option value="MNT">MNT</option>
              </select>
            </div>
            {/* Min Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Amount</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">{getCurrencySymbol(form.currency)}</span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={form.min_amount}
                  onChange={(e)=>setForm({...form, min_amount:e.target.value})}
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
            {/* Max Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Maximum Amount</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">{getCurrencySymbol(form.currency)}</span>
                <input
                  type="number"
                  step="1"
                  min={form.min_amount || 0}
                  value={form.max_amount}
                  onChange={(e)=>setForm({...form, max_amount:e.target.value})}
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Product Description</label>
              <textarea
                value={form.product_description}
                onChange={(e)=>setForm({...form, product_description: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                rows={3}
              />
            </div>
            {/* Product Status Toggle */}
            <div className="flex items-center gap-3">
              <label className="block text-sm font-medium text-gray-700">Product Status</label>
              <button
                type="button"
                onClick={()=>setForm({...form, product_status: form.product_status === 'Active' ? 'Inactive' : 'Active'})}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${form.product_status === 'Active' ? 'bg-green-500 focus:ring-green-300' : 'bg-gray-300 focus:ring-gray-300'}`}
                aria-pressed={form.product_status === 'Active'}
                aria-label="Toggle product status"
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${form.product_status === 'Active' ? 'translate-x-6' : 'translate-x-1'}`}></span>
              </button>
              <span className={`text-sm ${form.product_status === 'Active' ? 'text-green-700' : 'text-gray-700'}`}>{form.product_status}</span>
            </div>
            <div className="md:col-span-2 flex justify-end space-x-4 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {loading && (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                <span>
                  {loading 
                    ? 'Creating...' 
                    : 'Create Product'
                  }
                </span>
              </button>
            </div>
            {error && <div className="md:col-span-2 text-red-600 text-sm">{error}</div>}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Loan Products</h1>
            <p className="text-gray-600">Manage and view loan products and configurations</p>
          </div>
          <button
            onClick={handleCreateNew}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 self-start sm:self-center"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>Create New Product</span>
          </button>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No products found</h3>
          <p className="text-gray-500 mb-8 max-w-md mx-auto">Get started by creating your first loan product. This will help you configure loan types, interest rates, and terms.</p>
          <button
            onClick={handleCreateNew}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 mx-auto"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>Create First Product</span>
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Interest Rate (%)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Term (Month)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Currency
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount Range
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {products.map(p => (
                  <tr key={p.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">{p.product_id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{p.product_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{p.interest_rate}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{p.term_min}-{p.term_max}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{p.currency}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{getCurrencySymbol(p.currency)}{p.min_amount} - {getCurrencySymbol(p.currency)}{p.max_amount}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${p.product_status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {p.product_status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(p.date).toLocaleDateString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <button
                        onClick={() => handleEditProduct(p)}
                        className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                        title="View/Edit Product"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedProduct && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Product Details</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Product ID</label>
                  <p className="text-sm text-gray-900">{selectedProduct.product_id}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Product Name</label>
                  <p className="text-sm text-gray-900">{selectedProduct.product_name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Interest Rate</label>
                  <p className="text-sm text-gray-900">{selectedProduct.interest_rate}%</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Term Range</label>
                  <p className="text-sm text-gray-900">{selectedProduct.term_min} - {selectedProduct.term_max} months</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Currency</label>
                  <p className="text-sm text-gray-900">{selectedProduct.currency}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Amount Range</label>
                  <p className="text-sm text-gray-900">{getCurrencySymbol(selectedProduct.currency)}{selectedProduct.min_amount} - {getCurrencySymbol(selectedProduct.currency)}{selectedProduct.max_amount}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={editForm.product_description}
                    onChange={(e) => setEditForm({...editForm, product_description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    rows={3}
                    placeholder="Enter product description..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Product Status</label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setEditForm({...editForm, product_status: editForm.product_status === 'Active' ? 'Inactive' : 'Active'})}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${editForm.product_status === 'Active' ? 'bg-green-500 focus:ring-green-300' : 'bg-gray-300 focus:ring-gray-300'}`}
                      aria-pressed={editForm.product_status === 'Active'}
                      aria-label="Toggle product status"
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${editForm.product_status === 'Active' ? 'translate-x-6' : 'translate-x-1'}`}></span>
                    </button>
                    <span className={`text-sm ${editForm.product_status === 'Active' ? 'text-green-700' : 'text-gray-700'}`}>{editForm.product_status}</span>
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
                  onClick={handleUpdateProduct}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Updating...' : 'Update Product'}
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
};

export default LoanProducts;
