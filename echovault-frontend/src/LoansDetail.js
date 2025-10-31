import React, { useEffect, useMemo, useState } from 'react';

const apiBase = (typeof window !== 'undefined' && window.REACT_APP_API_URL) || process.env.REACT_APP_API_URL || `${window.location.origin}/wp-json`;
const getCurrencySymbol = (c) => (c === 'MNT' ? '₮' : '$');

const Tabs = ['Summary','Repayment Schedule','Bank Statements','Collateral','Contract','Note','Settings'];

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

const LoansDetail = ({ token, loanId, onBack, onOpenBorrower }) => {
  const [activeTab, setActiveTab] = useState('Summary');
  const [loan, setLoan] = useState(null);
  const [product, setProduct] = useState(null);
  const [borrower, setBorrower] = useState(null);
  const [coBorrower, setCoBorrower] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bankMedia, setBankMedia] = useState([]);

  const load = async () => {
    if (!token || !loanId) return;
    setLoading(true);
    setError('');
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const loanResp = await fetch(`${apiBase}/wp/v2/loans/${loanId}?context=edit`, { headers, mode: 'cors' });
      if (!loanResp.ok) throw new Error('Failed to load loan');
      const loanJson = await loanResp.json();
      setLoan(loanJson);
      const productId = loanJson.meta?.loan_product_id;
      if (productId) {
        const prodResp = await fetch(`${apiBase}/wp/v2/loan-product/${productId}?context=edit`, { headers, mode: 'cors' });
        if (prodResp.ok) setProduct(await prodResp.json());
      }
      // Fetch borrower if possible - try multiple ways to extract borrower ID
      let borrowerId = toId(loanJson.meta?.borrower_id) 
        || toId(loanJson.borrower) 
        || toId(loanJson.meta?.borrower) 
        || toId(loanJson.meta?.borrower_profile);
      
      // Also check if borrower_id might be stored in fields or acf
      if (!borrowerId) {
        borrowerId = toId(loanJson.fields?.borrower_id) 
          || toId(loanJson.acf?.borrower_id)
          || toId(loanJson.fields?.borrower)
          || toId(loanJson.acf?.borrower);
      }
      
      // Check if borrower is embedded as object with id property
      if (!borrowerId && loanJson.borrower && typeof loanJson.borrower === 'object' && !Array.isArray(loanJson.borrower)) {
        borrowerId = toId(loanJson.borrower.id) || toId(loanJson.borrower.ID);
      }
      
      console.log('LoansDetail: Extracted borrower ID:', borrowerId, 'from loan:', { 
        meta_borrower_id: loanJson.meta?.borrower_id,
        borrower: loanJson.borrower,
        meta_borrower: loanJson.meta?.borrower,
        meta_borrower_profile: loanJson.meta?.borrower_profile,
        fields_borrower_id: loanJson.fields?.borrower_id,
        acf_borrower_id: loanJson.acf?.borrower_id,
        full_meta: loanJson.meta
      });
      
      if (borrowerId) {
        try {
          const bResp = await fetch(`${apiBase}/wp/v2/borrower-profile/${borrowerId}?context=edit`, { headers, mode: 'cors' });
          if (bResp.ok) {
            const borrowerData = await bResp.json();
            console.log('LoansDetail: Successfully fetched borrower:', borrowerData);
            setBorrower(borrowerData);
          } else {
            const errorText = await bResp.text();
            console.error('LoansDetail: Failed to fetch borrower profile:', bResp.status, bResp.statusText, errorText);
            console.log('LoansDetail: Loan has borrower meta fields:', {
              borrower_first_name: loanJson.meta?.borrower_first_name,
              borrower_last_name: loanJson.meta?.borrower_last_name,
              borrower_email: loanJson.meta?.borrower_email,
              borrower_phone: loanJson.meta?.borrower_phone,
              borrower_name: loanJson.borrower_name
            });
            // Don't set error state, but log it - borrower details might still be available in loan meta
          }
        } catch (fetchError) {
          console.error('LoansDetail: Error fetching borrower profile:', fetchError);
          console.log('LoansDetail: Loan has borrower meta fields:', {
            borrower_first_name: loanJson.meta?.borrower_first_name,
            borrower_last_name: loanJson.meta?.borrower_last_name,
            borrower_email: loanJson.meta?.borrower_email,
            borrower_phone: loanJson.meta?.borrower_phone,
            borrower_name: loanJson.borrower_name
          });
          // Don't set error state - borrower details might still be available in loan meta
        }
      } else {
        console.warn('LoansDetail: No borrower ID found in loan data. Loan meta:', loanJson.meta);
        console.log('LoansDetail: Checking for borrower info in loan directly:', {
          borrower_name: loanJson.borrower_name,
          borrower_first_name: loanJson.meta?.borrower_first_name,
          borrower_last_name: loanJson.meta?.borrower_last_name,
          borrower_email: loanJson.meta?.borrower_email,
          borrower_phone: loanJson.meta?.borrower_phone
        });
      }
      // Fetch co-borrower if selected
      const coStatus = toPrimitive(loanJson.co_borrower_status) || toPrimitive(loanJson.meta?.co_borrower_status);
      const coId = toId(loanJson.meta?.co_borrower_id) || toId(loanJson.co_borrower) || toId(loanJson.meta?.co_borrower);
      if (coStatus && /^yes$/i.test(String(coStatus)) && coId) {
        const cbResp = await fetch(`${apiBase}/wp/v2/borrower-profile/${coId}?context=edit`, { headers, mode: 'cors' });
        if (cbResp.ok) setCoBorrower(await cbResp.json());
      }
      // Load bank statements media if present
      const bs = loanJson.meta?.bank_statement || loanJson.fields?.bank_statement || loanJson.acf?.bank_statement || loanJson.bank_statement;
      let ids = [];
      if (Array.isArray(bs)) ids = bs.map(toId).filter(Boolean);
      else if (typeof bs === 'string') {
        try {
          const parsed = JSON.parse(bs);
          if (Array.isArray(parsed)) ids = parsed.map(toId).filter(Boolean);
        } catch (_) {
          ids = bs.split(',').map(s => s.trim()).map(toId).filter(Boolean);
        }
      } else if (typeof bs === 'number') ids = [String(bs)];
      if (ids.length) {
        const medias = [];
        for (const id of ids) {
          const mResp = await fetch(`${apiBase}/wp/v2/media/${id}`, { headers, mode: 'cors' });
          if (mResp.ok) medias.push(await mResp.json());
        }
        setBankMedia(medias);
      }
    } catch (e) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, loanId]);

  const schedule = useMemo(() => {
    try {
      if (!loan) return [];
      const principal = Number(loan.loan_amount || loan.meta?.loan_amount || 0);
      const term = Number(loan.loan_term || loan.meta?.loan_term || 0);
      const freq = loan.repayment_frequency || loan.meta?.repayment_frequency || 'Monthly';
      const method = loan.repayment_method || loan.meta?.repayment_method || 'Equal Principal';
      const interest = Number(loan.loan_interest || loan.meta?.loan_interest || product?.interest_rate || 0);
      const start = new Date(loan.start_date || loan.meta?.start_date || Date.now());
      if (!principal || !term) return [];
      const periodsForFrequency = (months, f) => {
        if (f === 'Monthly') return months;
        if (f === 'Fortnightly') return Math.ceil((months * 12 * 2) / 12);
        if (f === 'Weekly') return Math.ceil((months * 52) / 12);
        return months;
      };
      const ratePerPeriod = (annualPct, f) => {
        const annual = Number(annualPct || 0) / 100;
        if (f === 'Monthly') return annual / 12;
        if (f === 'Fortnightly') return annual / 26;
        if (f === 'Weekly') return annual / 52;
        return annual / 12;
      };
      const addDays = (d, days) => { const x = new Date(d); x.setDate(x.getDate() + days); return x; };
      const addMonths = (d, months) => { const x = new Date(d); x.setMonth(x.getMonth() + months); return x; };
      const nextDateFrom = (s, idx, f) => {
        if (f === 'Monthly') return addMonths(s, idx + 1);
        if (f === 'Fortnightly') return addDays(s, (idx + 1) * 14);
        if (f === 'Weekly') return addDays(s, (idx + 1) * 7);
        return addMonths(s, idx + 1);
      };
      const n = periodsForFrequency(term, freq);
      const r = ratePerPeriod(interest, freq);
      const rows = [];
      let balance = principal;
      if (method === 'Equal Total') {
        const payment = r === 0 ? principal / n : (principal * r) / (1 - Math.pow(1 + r, -n));
        for (let i = 0; i < n; i++) {
          const interestAmt = balance * r;
          const principalPaid = Math.min(payment - interestAmt, balance);
          balance = Math.max(0, balance - principalPaid);
          rows.push({ idx: i + 1, date: nextDateFrom(start, i, freq), payment, principal: principalPaid, interest: interestAmt, balance });
        }
      } else if (method === 'Interest-Only') {
        const interestOnly = balance * r;
        for (let i = 0; i < n - 1; i++) rows.push({ idx: i + 1, date: nextDateFrom(start, i, freq), payment: interestOnly, principal: 0, interest: interestOnly, balance });
        rows.push({ idx: n, date: nextDateFrom(start, n - 1, freq), payment: interestOnly + balance, principal: balance, interest: interestOnly, balance: 0 });
      } else {
        const principalPer = principal / n;
        for (let i = 0; i < n; i++) {
          const interestAmt = balance * r;
          const payment = principalPer + interestAmt;
          balance = Math.max(0, balance - principalPer);
          rows.push({ idx: i + 1, date: nextDateFrom(start, i, freq), payment, principal: principalPer, interest: interestAmt, balance });
        }
      }
      return rows;
    } catch (_) { return []; }
  }, [loan, product]);

  const downloadScheduleCsv = () => {
    if (!schedule || schedule.length === 0) return;
    const headers = ['#','Date','Payment','Principal','Interest','Balance'];
    const rows = schedule.map(r => [
      r.idx,
      new Date(r.date).toISOString().slice(0,10),
      r.payment.toFixed(2),
      r.principal.toFixed(2),
      r.interest.toFixed(2),
      r.balance.toFixed(2)
    ]);
    const csv = [headers, ...rows].map(cols => cols.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const fname = `repayment_schedule_${(loan?.loan_id || loan?.meta?.loan_id || 'loan')}.csv`;
    link.setAttribute('download', fname);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
      <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg className="animate-spin h-12 w-12 text-blue-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">Loading loan details...</h3>
      <p className="text-gray-500">Please wait while we fetch the loan and related profiles.</p>
    </div>
  );
  if (error) return (
    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>
  );
  if (!loan) return null;

  const currency = loan.loan_currency || loan.meta?.loan_currency || product?.currency || 'AUD';
  // Try multiple ways to extract borrower ID (matching the load function logic)
  let borrowerIdResolved = toId(loan?.meta?.borrower_id) 
    || toId(loan?.borrower) 
    || toId(loan?.meta?.borrower) 
    || toId(loan?.meta?.borrower_profile);
  if (!borrowerIdResolved) {
    borrowerIdResolved = toId(loan?.fields?.borrower_id) 
      || toId(loan?.acf?.borrower_id)
      || toId(loan?.fields?.borrower)
      || toId(loan?.acf?.borrower);
  }
  if (!borrowerIdResolved && loan?.borrower && typeof loan.borrower === 'object' && !Array.isArray(loan.borrower)) {
    borrowerIdResolved = toId(loan.borrower.id) || toId(loan.borrower.ID);
  }
  const coBorrowerIdResolved = toId(loan?.meta?.co_borrower_id) || toId(loan?.co_borrower) || toId(loan?.meta?.co_borrower);
  const rawStatus = ((loan.loan_status || loan.meta?.loan_status || loan.status || '')).toString();
  const statusLower = rawStatus.toLowerCase();
  let statusLabel = 'Unknown';
  if (statusLower === 'publish') statusLabel = 'Active';
  else if (statusLower === 'draft') statusLabel = 'Draft';
  else if (['pending','active','inactive','closed','rejected'].includes(statusLower)) statusLabel = statusLower.charAt(0).toUpperCase() + statusLower.slice(1);
  else statusLabel = rawStatus ? (rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1)) : '-';
  const badgeClass = (/^active$/i).test(statusLabel) ? 'bg-green-100 text-green-800'
    : (/^pending$/i).test(statusLabel) ? 'bg-blue-100 text-blue-800'
    : (/^rejected$/i).test(statusLabel) ? 'bg-red-100 text-red-800'
    : (/^inactive$/i).test(statusLabel) ? 'bg-gray-200 text-gray-800'
    : (/^closed$/i).test(statusLabel) ? 'bg-purple-100 text-purple-800'
    : (/^draft$/i).test(statusLabel) ? 'bg-yellow-100 text-yellow-800'
    : 'bg-gray-100 text-gray-800';

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={onBack}
            className="mr-4 p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            title="Back"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-900">Loan Details</h2>
              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${badgeClass}`}>{statusLabel}</span>
            </div>
            <p className="text-gray-600">{loan.loan_id || loan.meta?.loan_id}</p>
          </div>
        </div>
        <div />
      </div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {Tabs.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setActiveTab(t)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === t
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {t}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {activeTab === 'Summary' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 border rounded-lg bg-white">
            <div className="font-semibold text-gray-900 mb-2">Loan Summary</div>
            <div className="grid grid-cols-2 gap-y-1 text-sm">
              <div className="text-gray-500">Loan ID</div><div className="text-gray-900 font-medium">{loan.loan_id || loan.meta?.loan_id}</div>
              <div className="text-gray-500">Product</div><div className="text-gray-900 font-medium">{loan.loan_product || loan.meta?.loan_product_name || '-'}</div>
              <div className="text-gray-500">Interest</div><div className="text-gray-900 font-medium">{loan.loan_interest || loan.meta?.loan_interest}%</div>
              <div className="text-gray-500">Term</div><div className="text-gray-900 font-medium">{loan.loan_term || loan.meta?.loan_term} months</div>
              <div className="text-gray-500">Amount</div><div className="text-gray-900 font-medium">{getCurrencySymbol(currency)}{loan.loan_amount || loan.meta?.loan_amount}</div>
              <div className="text-gray-500">Method</div><div className="text-gray-900 font-medium">{loan.repayment_method || loan.meta?.repayment_method}</div>
              <div className="text-gray-500">Frequency</div><div className="text-gray-900 font-medium">{loan.repayment_frequency || loan.meta?.repayment_frequency}</div>
              <div className="text-gray-500">Start</div><div className="text-gray-900 font-medium">{loan.start_date || loan.meta?.start_date}</div>
              <div className="text-gray-500">End</div><div className="text-gray-900 font-medium">{loan.end_date || loan.meta?.end_date}</div>
            </div>
          </div>
          <div className="p-4 border rounded-lg bg-white">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold text-gray-900">Borrower</div>
              {(borrowerIdResolved) && onOpenBorrower && (
                <button
                  onClick={() => onOpenBorrower(borrowerIdResolved)}
                  className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded"
                >
                  View Profile
                </button>
              )}
            </div>
            <div className="text-sm text-gray-900 font-medium">
              {(loan.borrower_name && String(loan.borrower_name).trim())
                || toPrimitive(loan.meta?.borrower_name)
                || [toPrimitive(loan.meta?.borrower_first_name), toPrimitive(loan.meta?.borrower_last_name)].filter(Boolean).join(' ')
                || [toPrimitive(borrower?.first_name), toPrimitive(borrower?.last_name)].filter(Boolean).join(' ')
                || toPrimitive(borrower?.title?.rendered) || '-'}
            </div>
            <div className="text-xs text-gray-600">{toPrimitive(loan.borrower_email) || toPrimitive(loan.meta?.borrower_email) || toPrimitive(borrower?.email_address) || ''}</div>
            <div className="text-xs text-gray-600">{toPrimitive(loan.borrower_phone) || toPrimitive(loan.meta?.borrower_phone) || toPrimitive(borrower?.mobile_number) || ''}</div>
            <div className="grid grid-cols-1 gap-1 text-xs text-gray-600 mt-2">
              {(toPrimitive(borrower?.date_of_birth) || toPrimitive(loan.meta?.borrower_date_of_birth)) && (
                <div><span className="text-gray-500">DOB: </span>{toPrimitive(borrower?.date_of_birth) || toPrimitive(loan.meta?.borrower_date_of_birth)}</div>
              )}
              {(toPrimitive(borrower?.home_address) || toPrimitive(loan.meta?.borrower_home_address) || toPrimitive(loan.meta?.borrower_address)) && (
                <div><span className="text-gray-500">Address: </span>{toPrimitive(borrower?.home_address) || toPrimitive(loan.meta?.borrower_home_address) || toPrimitive(loan.meta?.borrower_address)}</div>
              )}
              {(toPrimitive(borrower?.employment_status) || toPrimitive(loan.meta?.borrower_employment_status)) && (
                <div><span className="text-gray-500">Employment: </span>{toPrimitive(borrower?.employment_status) || toPrimitive(loan.meta?.borrower_employment_status)}</div>
              )}
            </div>
          </div>
          <div className="p-4 border rounded-lg bg-white">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold text-gray-900">Co-borrower</div>
              {(coBorrowerIdResolved) && onOpenBorrower && (
                <button
                  onClick={() => onOpenBorrower(coBorrowerIdResolved)}
                  className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded"
                >
                  View Profile
                </button>
              )}
            </div>
            {coBorrower ? (
              <>
                <div className="text-sm text-gray-900 font-medium">
                  {[toPrimitive(coBorrower.first_name), toPrimitive(coBorrower.last_name)].filter(Boolean).join(' ') || toPrimitive(coBorrower?.title?.rendered) || '-'}
                </div>
                <div className="text-xs text-gray-600">{toPrimitive(coBorrower?.email_address) || ''}</div>
                <div className="text-xs text-gray-600">{toPrimitive(coBorrower?.mobile_number) || ''}</div>
                <div className="grid grid-cols-1 gap-1 text-xs text-gray-600 mt-2">
                  {toPrimitive(coBorrower?.date_of_birth) && (<div><span className="text-gray-500">DOB: </span>{toPrimitive(coBorrower?.date_of_birth)}</div>)}
                  {toPrimitive(coBorrower?.home_address) && (<div><span className="text-gray-500">Address: </span>{toPrimitive(coBorrower?.home_address)}</div>)}
                  {toPrimitive(coBorrower?.employment_status) && (<div><span className="text-gray-500">Employment: </span>{toPrimitive(coBorrower?.employment_status)}</div>)}
                </div>
              </>
            ) : (
              <div className="text-sm text-gray-500">No co-borrower</div>
            )}
          </div>
          <div className="p-4 border rounded-lg bg-white">
            <div className="font-semibold text-gray-900 mb-2">Accounts</div>
            <div className="text-sm">
              <div className="text-gray-500">Disbursement</div>
              <div className="text-gray-900 font-medium break-all">{loan.loan_disbursement_account || '-'}</div>
              <div className="mt-2 text-gray-500">Repayment</div>
              <div className="text-gray-900 font-medium break-all">{loan.loan_repayment_account || '-'}</div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Repayment Schedule' && (
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900">Repayment Schedule</h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                disabled={!schedule || schedule.length===0}
                className="px-3 py-1.5 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Print schedule"
              >
                Print
              </button>
              <button
                type="button"
                onClick={downloadScheduleCsv}
                disabled={!schedule || schedule.length===0}
                className="px-3 py-1.5 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Download CSV"
              >
                Download CSV
              </button>
            </div>
          </div>
          {(!schedule || schedule.length===0) ? (
            <div className="text-gray-600 text-sm">No schedule available.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-right">Payment</th>
                    <th className="px-3 py-2 text-right">Principal</th>
                    <th className="px-3 py-2 text-right">Interest</th>
                    <th className="px-3 py-2 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {schedule.map(r => (
                    <tr key={r.idx}>
                      <td className="px-3 py-1">{r.idx}</td>
                      <td className="px-3 py-1">{new Date(r.date).toLocaleDateString()}</td>
                      <td className="px-3 py-1 text-right">{getCurrencySymbol(currency)}{r.payment.toFixed(2)}</td>
                      <td className="px-3 py-1 text-right">{getCurrencySymbol(currency)}{r.principal.toFixed(2)}</td>
                      <td className="px-3 py-1 text-right">{getCurrencySymbol(currency)}{r.interest.toFixed(2)}</td>
                      <td className="px-3 py-1 text-right">{getCurrencySymbol(currency)}{r.balance.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'Bank Statements' && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Bank Statements</h3>
          {(!bankMedia || bankMedia.length === 0) ? (
            <div className="text-sm text-gray-600">No bank statements uploaded.</div>
          ) : (
            <ul className="divide-y divide-gray-200 rounded-md border border-gray-200">
              {bankMedia.map(m => (
                <li key={m.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate text-gray-900">{m.title?.rendered || m.filename || `File #${m.id}`}</div>
                    <div className="text-xs text-gray-500">{m.mime_type || m.post_mime_type}</div>
                  </div>
                  {m.source_url && (
                    <div className="flex items-center gap-2">
                      <a href={m.source_url} target="_blank" rel="noopener noreferrer" className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50">View</a>
                      <a href={m.source_url} download className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50">Download</a>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {activeTab === 'Note' && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Note</h3>
          <div className="text-gray-900 whitespace-pre-wrap">{((loan.loan_note || loan.meta?.loan_note || '').toString().trim()) || 'No note saved.'}</div>
        </div>
      )}

      {activeTab !== 'Summary' && activeTab !== 'Repayment Schedule' && activeTab !== 'Note' && activeTab !== 'Bank Statements' && (
        <div className="bg-white rounded-lg border p-8 text-center text-gray-500">{activeTab} coming soon.</div>
      )}
    </div>
  );
};

export default LoansDetail;


