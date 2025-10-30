import React, { useEffect, useMemo, useState } from 'react';

const apiBase = (typeof window !== 'undefined' && window.REACT_APP_API_URL) || process.env.REACT_APP_API_URL || `${window.location.origin}/wp-json`;
const getCurrencySymbol = (c) => (c === 'MNT' ? '₮' : '$');

const toPrimitive = (val, fallback = '') => {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return val;
  if (Array.isArray(val)) return toPrimitive(val[0], fallback);
  if (val && typeof val === 'object') {
    if ('rendered' in val) return toPrimitive(val.rendered, fallback);
    return fallback;
  }
  return fallback;
};

const toId = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number' || typeof val === 'string') return String(val);
  if (Array.isArray(val)) return toId(val[0]);
  if (typeof val === 'object') {
    if ('id' in val) return String(val.id);
    if ('ID' in val) return String(val.ID);
  }
  return '';
};

const LoansActive = ({ token, setCurrentView }) => {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [products, setProducts] = useState([]);
  const [systemAccounts, setSystemAccounts] = useState([]);
  const [borrowers, setBorrowers] = useState([]);

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [loansResp, productsResp, accountsResp, borrowersResp] = await Promise.all([
          fetch(`${apiBase}/wp/v2/loans?per_page=100&status=publish,draft&context=edit`, {
            headers: { 'Authorization': `Bearer ${token}` },
            mode: 'cors'
          }),
          fetch(`${apiBase}/wp/v2/loan-product?per_page=100&context=edit&status=publish,draft`, {
            headers: { 'Authorization': `Bearer ${token}` },
            mode: 'cors'
          }),
          fetch(`${apiBase}/wp/v2/bank-account-system?per_page=100&status=publish,draft`, {
            headers: { 'Authorization': `Bearer ${token}` },
            mode: 'cors'
          }),
          fetch(`${apiBase}/wp/v2/borrower-profile?per_page=100&context=edit`, {
            headers: { 'Authorization': `Bearer ${token}` },
            mode: 'cors'
          })
        ]);
        if (!loansResp.ok) throw new Error('Failed to fetch loans');
        if (!productsResp.ok) throw new Error('Failed to fetch products');
        if (!accountsResp.ok) throw new Error('Failed to fetch accounts');
        if (!borrowersResp.ok) throw new Error('Failed to fetch borrowers');
        const [loansJson, productsJson, accountsJson, borrowersJson] = await Promise.all([loansResp.json(), productsResp.json(), accountsResp.json(), borrowersResp.json()]);
        setLoans(loansJson || []);
        setProducts(productsJson || []);
        setSystemAccounts(accountsJson || []);
        setBorrowers(borrowersJson || []);
      } catch (e) {
        setError(e.message || 'Failed to load loans');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  const productIdToName = useMemo(() => {
    const map = new Map();
    (products || []).forEach(p => {
      const id = p.id;
      const name = (p.product_name) || (p.title && p.title.rendered) || '';
      if (id && name) map.set(String(id), String(name));
    });
    return map;
  }, [products]);

  const productIdToCurrency = useMemo(() => {
    const map = new Map();
    (products || []).forEach(p => {
      const id = p.id;
      const currency = (Array.isArray(p.currency) ? p.currency[0] : p.currency) || 'AUD';
      if (id && currency) map.set(String(id), String(currency));
    });
    return map;
  }, [products]);

  const systemAccountIdToBank = useMemo(() => {
    const map = new Map();
    (systemAccounts || []).forEach(a => {
      const id = a.id;
      const country = Array.isArray(a.account_type) ? a.account_type[0] : a.account_type;
      const bank = country === 'Australia'
        ? (Array.isArray(a.bank_name_au) ? a.bank_name_au[0] : a.bank_name_au)
        : (Array.isArray(a.bank_name_mn) ? a.bank_name_mn[0] : a.bank_name_mn);
      if (id) map.set(String(id), { bank: bank || '', name: a.account_name || '' });
    });
    return map;
  }, [systemAccounts]);

  const borrowerIdToInfo = useMemo(() => {
    const map = new Map();
    (borrowers || []).forEach(b => {
      const name = [toPrimitive(b.first_name), toPrimitive(b.last_name)].filter(Boolean).join(' ');
      map.set(String(b.id), {
        name,
        email: toPrimitive(b.email_address),
        phone: toPrimitive(b.mobile_number)
      });
    });
    return map;
  }, [borrowers]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="animate-spin h-12 w-12 text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Loading loans...</h3>
        <p className="text-gray-500">Please wait while we fetch loans.</p>
      </div>
    );
  }

  if (error) {
    return <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>;
  }

  if (!loans || loans.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h10M5 19h14M7 6h10M12 3v3" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">No loans yet</h3>
        <p className="text-gray-500">Create a loan to see it listed here.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loan ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Borrower</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Currency</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Term</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Frequency</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loans.map(l => {
              const loanId = toPrimitive(l.loan_id) || toPrimitive(l.meta?.loan_id) || toPrimitive(l.title?.rendered, '-');
              let currency = toPrimitive(l.loan_currency) || toPrimitive(l.meta?.loan_currency) || '';
              const amountRaw = toPrimitive(l.loan_amount) || toPrimitive(l.meta?.loan_amount) || 0;
              const amount = Number(amountRaw) || 0;
              const status = toPrimitive(l.status, '-');
              let productDisp = toPrimitive(l.meta?.loan_product_name);
              if (!productDisp) {
                const rawProd = toPrimitive(l.loan_product) || toPrimitive(l.meta?.loan_product);
                if (rawProd) {
                  const byId = productIdToName.get(String(rawProd));
                  productDisp = byId || rawProd;
                  if (!currency) {
                    const cById = productIdToCurrency.get(String(rawProd));
                    if (cById) currency = cById;
                  }
                }
              }
              if (!productDisp) productDisp = '-';
              const created = toPrimitive(l.date) || new Date().toISOString();
              // Prefer direct saved name fields first
              let nameDirect = toPrimitive(l.borrower_name) || toPrimitive(l.meta?.borrower_name) || '';
              const emailDirect = toPrimitive(l.borrower_email) || toPrimitive(l.meta?.borrower_email) || '';
              const phoneDirect = toPrimitive(l.borrower_phone) || toPrimitive(l.meta?.borrower_phone) || '';

              // Try ID mapping when no direct name
              const borrowerId = toId(l.meta?.borrower_id) || toId(l.borrower) || toId(l.meta?.borrower) || toId(l.meta?.borrower_profile);
              let bInfo = null;
              if (nameDirect) {
                bInfo = { name: nameDirect, email: emailDirect, phone: phoneDirect };
              } else if (borrowerId) {
                bInfo = borrowerIdToInfo.get(String(borrowerId)) || null;
              }
              // Fallback to separate first/last meta
              if (!bInfo) {
                const first = toPrimitive(l.meta?.borrower_first_name) || toPrimitive(l.borrower_first_name) || '';
                const last = toPrimitive(l.meta?.borrower_last_name) || toPrimitive(l.borrower_last_name) || '';
                const email = emailDirect;
                const phone = phoneDirect;
                const name = [first, last].filter(Boolean).join(' ');
                if (name || email || phone) bInfo = { name, email, phone };
              }
              const term = toPrimitive(l.loan_term) || toPrimitive(l.meta?.loan_term) || '';
              const method = toPrimitive(l.repayment_method) || toPrimitive(l.meta?.repayment_method) || '';
              const freq = toPrimitive(l.repayment_frequency) || toPrimitive(l.meta?.repayment_frequency) || '';
              return (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">{loanId}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {bInfo ? (
                      <div>
                        <div className="font-medium">{bInfo.name || '-'}</div>
                        <div className="text-gray-500 text-xs">{bInfo.email || '-'}</div>
                        <div className="text-gray-500 text-xs">{bInfo.phone || '-'}</div>
                      </div>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{getCurrencySymbol(currency)}{amount}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{toPrimitive(currency, '-')}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{productDisp}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{term || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{method || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{freq || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${status === 'publish' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => setCurrentView({ view: 'loan-detail', loanId: l.id })}
                      className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LoansActive;


