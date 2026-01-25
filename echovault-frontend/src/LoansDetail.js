import React, { useEffect, useState } from 'react';

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

const LoansDetail = ({ token, loanId, onBack, onOpenBorrower, onEditLoan }) => {
  const [activeTab, setActiveTab] = useState('Summary');
  const [loan, setLoan] = useState(null);
  const [product, setProduct] = useState(null);
  const [borrower, setBorrower] = useState(null);
  const [coBorrower, setCoBorrower] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bankMedia, setBankMedia] = useState([]);
  const [collateralMedia, setCollateralMedia] = useState(null);
  const [contractMedia, setContractMedia] = useState(null);

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
      
      if (borrowerId) {
        try {
          const bResp = await fetch(`${apiBase}/wp/v2/borrower-profile/${borrowerId}?context=edit`, { headers, mode: 'cors' });
          if (bResp.ok) {
            const borrowerData = await bResp.json();
            setBorrower(borrowerData);
          } else {
            const errorText = await bResp.text();
            console.error('LoansDetail: Failed to fetch borrower profile:', bResp.status, bResp.statusText, errorText);
            // Don't set error state, but log it - borrower details might still be available in loan meta
          }
        } catch (fetchError) {
          console.error('LoansDetail: Error fetching borrower profile:', fetchError);
          // Don't set error state - borrower details might still be available in loan meta
        }
      } else {
        console.warn('LoansDetail: No borrower ID found in loan data. Loan meta:', loanJson.meta);
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
      // Load collateral media if present
      const colId = toId(loanJson.meta?.collateral || loanJson.fields?.collateral || loanJson.acf?.collateral || loanJson.collateral);
      if (colId) {
        const colResp = await fetch(`${apiBase}/wp/v2/media/${colId}`, { headers, mode: 'cors' });
        if (colResp.ok) setCollateralMedia(await colResp.json());
      }
      // Load contract media if present
      const conId = toId(loanJson.meta?.loan_contract || loanJson.fields?.loan_contract || loanJson.acf?.loan_contract || loanJson.loan_contract);
      if (conId) {
        const conResp = await fetch(`${apiBase}/wp/v2/media/${conId}`, { headers, mode: 'cors' });
        if (conResp.ok) setContractMedia(await conResp.json());
      }
    } catch (e) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, loanId]);

  const [schedule, setSchedule] = useState([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [paymentHistoryLoading, setPaymentHistoryLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    paid_interest: '',
    paid_principles: '',
    payment_date: new Date().toISOString().split('T')[0],
    repayment_note: ''
  });
  const [paymentFormErrors, setPaymentFormErrors] = useState({
    paid_interest: ''
  });
  const [paymentLoading, setPaymentLoading] = useState(false);

  // Fetch repayment schedule from backend API
  useEffect(() => {
    const fetchSchedule = async () => {
      if (!loan || !token || !loanId) {
        setSchedule([]);
        return;
      }

      setScheduleLoading(true);
      try {
        const endpoint = `${apiBase}/echovault/v2/get-repayment-schedule?loan_id=${loanId}`;
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'Accept': 'application/json'
          },
          mode: 'cors',
          credentials: 'omit'
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.schedule && data.schedule.length > 0) {
            setSchedule(data.schedule);
            return;
          }
        }
        
        // Note: Schedule should generate automatically when loan is created
        // No need to call API endpoint - backend handles it via hooks
        
        // If no schedule exists, return empty
        setSchedule([]);
      } catch (error) {
        console.warn('Error fetching repayment schedule:', error);
        setSchedule([]);
      } finally {
        setScheduleLoading(false);
      }
    };

    fetchSchedule();
    
    // Fetch payment history
    const fetchPaymentHistory = async () => {
      if (!loanId || !token) {
        setPaymentHistory([]);
        return;
      }

      setPaymentHistoryLoading(true);
      try {
        const endpoint = `${apiBase}/echovault/v2/get-payment-history?loan_id=${loanId}`;
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'Accept': 'application/json'
          },
          mode: 'cors',
          credentials: 'omit'
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.history) {
            setPaymentHistory(data.history);
            return;
          }
        }
        
        setPaymentHistory([]);
      } catch (error) {
        console.warn('Error fetching payment history:', error);
        setPaymentHistory([]);
      } finally {
        setPaymentHistoryLoading(false);
      }
    };

    fetchPaymentHistory();
  }, [loan, token, loanId]);

  // Helper function to calculate maximum available interest for payment
  const calculateMaxAvailableInterest = (segment, paymentDateStr) => {
    const loanInterest = parseFloat(loan?.loan_interest || loan?.meta?.loan_interest || 0) / 100;
    const segmentEnd = segment.segment_end;
    
    // Scheduled interest for the segment period
    const scheduledInterest = parseFloat(segment.accrued_interest || 0);
    
    // Interest already paid for this segment
    const paidInterest = parseFloat(segment.paid_interest || 0);
    
    // Outstanding interest (unpaid from previous periods or this segment)
    const outstandingInterest = parseFloat(segment.outstanding_interest || 0);
    
    // Calculate remaining scheduled interest (not yet paid)
    const remainingScheduledInterest = Math.max(0, scheduledInterest - paidInterest);
    
    // Available interest = max of (remaining scheduled, outstanding) + extended period interest
    // This handles cases where:
    // - No payment made: remaining = scheduled, outstanding = 0, so use remaining
    // - Partial payment: remaining = scheduled - paid, outstanding may be set, use max
    // - Outstanding from previous: outstanding > 0, use outstanding
    let interestAvailable = Math.max(remainingScheduledInterest, outstandingInterest);
    
    // If payment date is after segment_end, calculate additional interest for extended period
    if (paymentDateStr && segmentEnd && segment.segment_start) {
      try {
        const paymentDate = new Date(paymentDateStr);
        const segmentEndDate = new Date(segmentEnd);
        
        // If payment is after segment end, add interest for the extended period
        if (paymentDate > segmentEndDate) {
          const balanceForInterest = parseFloat(segment.remain_balance || segment.start_balance || 0);
          const extendedDays = Math.max(0, Math.ceil((paymentDate - segmentEndDate) / (1000 * 60 * 60 * 24)));
          
          if (loanInterest > 0 && balanceForInterest > 0 && extendedDays > 0) {
            const extendedInterest = balanceForInterest * loanInterest * (extendedDays / 30);
            interestAvailable += extendedInterest;
          }
        }
      } catch (e) {
        console.warn('Error calculating extended interest:', e);
      }
    }
    
    return interestAvailable;
  };

  // Register payment
  const registerPayment = async () => {
    if (!selectedSegment || !token || !loanId) return;
    
    // Validate payment date is provided
    if (!paymentForm.payment_date) {
      alert('Payment Date is required');
      return;
    }
    
    // At least one payment (interest or principal) must be provided
    const paidInterest = parseFloat(paymentForm.paid_interest) || 0;
    const paidPrincipal = parseFloat(paymentForm.paid_principles) || 0;
    
    if (paidInterest === 0 && paidPrincipal === 0) {
      alert('Please enter at least an Interest or Principal payment amount');
      return;
    }
    
    // Validate interest payment does not exceed available interest
    if (paidInterest > 0) {
      const paymentDateStr = paymentForm.payment_date || selectedSegment.paid_date || selectedSegment.segment_start;
      const maxInterest = calculateMaxAvailableInterest(selectedSegment, paymentDateStr);
      
      if (paidInterest > maxInterest) {
        setPaymentFormErrors({...paymentFormErrors, paid_interest: `Interest payment (${getCurrencySymbol(currency)}${paidInterest.toFixed(2)}) cannot exceed the available interest amount (${getCurrencySymbol(currency)}${maxInterest.toFixed(2)}). Please enter a value less than or equal to this amount.`});
        return;
      }
    }
    
    setPaymentLoading(true);
    try {
      const endpoint = `${apiBase}/echovault/v2/register-payment`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          loan_id: parseInt(loanId),
          segment_id: parseInt(selectedSegment.id),
          paid_interest: paidInterest,
          paid_principles: paidPrincipal,
          payment_date: paymentForm.payment_date,
          repayment_note: paymentForm.repayment_note || ''
        }),
        mode: 'cors',
        credentials: 'omit'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Use schedule from response if available, otherwise refresh
          if (data.schedule && Array.isArray(data.schedule)) {
            setSchedule(data.schedule);
          } else {
            // Refresh schedule
            const refreshEndpoint = `${apiBase}/echovault/v2/get-repayment-schedule?loan_id=${loanId}`;
            const refreshResponse = await fetch(refreshEndpoint, {
              method: 'GET',
              headers: {
                'Authorization': token ? `Bearer ${token}` : '',
                'Accept': 'application/json'
              },
              mode: 'cors',
              credentials: 'omit'
            });
            if (refreshResponse.ok) {
              const refreshData = await refreshResponse.json();
              if (refreshData.success && refreshData.schedule) {
                setSchedule(refreshData.schedule);
              }
            }
          }
          
          // Refresh payment history after successful payment
          const historyEndpoint = `${apiBase}/echovault/v2/get-payment-history?loan_id=${loanId}`;
          const historyResponse = await fetch(historyEndpoint, {
            method: 'GET',
            headers: {
              'Authorization': token ? `Bearer ${token}` : '',
              'Accept': 'application/json'
            },
            mode: 'cors',
            credentials: 'omit'
          });
          if (historyResponse.ok) {
            const historyData = await historyResponse.json();
            if (historyData.success && historyData.history) {
              setPaymentHistory(historyData.history);
            }
          }
          setShowPaymentModal(false);
          setSelectedSegment(null);
          setPaymentForm({
            paid_interest: '',
            paid_principles: '',
            payment_date: new Date().toISOString().split('T')[0],
            repayment_note: ''
          });
          setPaymentFormErrors({ paid_interest: '' });
        } else {
          alert('Error: ' + (data.error || 'Failed to register payment'));
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Failed to register payment' }));
        alert('Error: ' + (errorData.error || 'Failed to register payment'));
      }
    } catch (error) {
      console.error('Error registering payment:', error);
      alert('Error: ' + error.message);
    } finally {
      setPaymentLoading(false);
    }
  };

  const openPaymentModal = (segment) => {
    setSelectedSegment(segment);
    
    // Find the latest payment date from all segments to set minimum payment date
    let latestPaymentDate = null;
    if (schedule && schedule.length > 0) {
      schedule.forEach(s => {
        if (s.paid_date && s.paid_date.trim() !== '' && s.paid_date !== '-') {
          const paidDate = new Date(s.paid_date);
          if (!latestPaymentDate || paidDate > latestPaymentDate) {
            latestPaymentDate = paidDate;
          }
        }
      });
    }
    
    // Default payment date: today or the day after latest payment (whichever is later)
    let defaultPaymentDate = new Date();
    if (latestPaymentDate) {
      const nextDay = new Date(latestPaymentDate);
      nextDay.setDate(nextDay.getDate() + 1);
      if (nextDay > defaultPaymentDate) {
        defaultPaymentDate = nextDay;
      }
    }
    
      setPaymentForm({
      paid_interest: '',
      paid_principles: '',
      payment_date: defaultPaymentDate.toISOString().split('T')[0],
      repayment_note: ''
      });
    setShowPaymentModal(true);
  };

  const downloadPaymentHistoryCsv = () => {
    if (!paymentHistory || paymentHistory.length === 0) return;
    const headers = ['ID','Segment ID','Segment Start','Segment End','Payment Date','Loan Days','Paid Loan Days','Paid Interest','Paid Principal','Total Payment','Balance Before','Balance After','Outstanding Interest Before','Outstanding Interest After','Note','Created At'];
    const rows = paymentHistory.map(h => [
      h.id,
      h.segment_id || '',
      h.segment_start || '',
      h.segment_end || '',
      h.payment_date || '',
      h.loan_days || 0,
      h.paid_loan_days || 0,
      (h.paid_interest || 0).toFixed(2),
      (h.paid_principal || 0).toFixed(2),
      (h.total_payment || 0).toFixed(2),
      (h.balance_before || 0).toFixed(2),
      (h.balance_after || 0).toFixed(2),
      (h.outstanding_interest_before || 0).toFixed(2),
      (h.outstanding_interest_after || 0).toFixed(2),
      h.note || '',
      h.created_at || ''
    ]);
    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payment_history_loan_${loanId}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const downloadScheduleCsv = () => {
    if (!schedule || schedule.length === 0) return;
    const headers = ['ID','Segment Start','Segment End','Days','Start Balance','Accrued Interest','Paid Interest','Paid Principal','Total Payment','Outstanding Interest','Remain Balance','Status','Note'];
    const rows = schedule.map(r => [
      r.id,
      r.segment_start || '',
      r.segment_end || '',
      r.loan_days || 0,
      (r.start_balance || 0).toFixed(2),
      (r.accrued_interest || 0).toFixed(2),
      (r.paid_interest || 0).toFixed(2),
      (r.paid_principles || 0).toFixed(2),
      (r.total_payment || 0).toFixed(2),
      (r.outstanding_interest || 0).toFixed(2),
      (r.remain_balance || 0).toFixed(2),
      r.repayment_status || 'Pending',
      r.repayment_note || ''
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
    <div className="w-full max-w-full overflow-x-hidden">
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
        <div>
          {loan && statusLabel.toLowerCase() === 'draft' && onEditLoan && (
            <button
              onClick={() => onEditLoan(loan)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span>Edit Draft</span>
            </button>
          )}
        </div>
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
              <div className="text-gray-500">Type</div><div className="text-gray-900 font-medium">{loan.repayment_type || loan.meta?.repayment_type || '-'}</div>
              <div className="text-gray-500">Start</div><div className="text-gray-900 font-medium">{loan.start_date || loan.meta?.start_date}</div>
              <div className="text-gray-500">End</div><div className="text-gray-900 font-medium">{loan.end_date || loan.meta?.end_date}</div>
              <div className="text-gray-500">Repayment Status</div>
              <div className="text-gray-900 font-medium">
                {(() => {
                  // Determine repayment status based on loan end date
                  // If current date > loan end date → "Overdue", otherwise → "Pending"
                  let displayStatus = 'Pending';
                  let statusClass = 'bg-gray-100 text-gray-800';
                  
                  const endDateStr = loan.end_date || loan.meta?.end_date;
                  if (endDateStr) {
                    try {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                      const endDate = new Date(endDateStr);
                      endDate.setHours(0, 0, 0, 0);
                      
                      if (endDate < today) {
                        // Loan end date has passed
                        displayStatus = 'Overdue';
                        statusClass = 'bg-red-100 text-red-800';
                      } else {
                        // Loan end date hasn't passed
                        displayStatus = 'Pending';
                        statusClass = 'bg-gray-100 text-gray-800';
                      }
                    } catch (e) {
                      // If date parsing fails, default to Pending
                      displayStatus = 'Pending';
                      statusClass = 'bg-gray-100 text-gray-800';
                    }
                  }
                  
                  return (
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${statusClass}`}>
                      {displayStatus}
                    </span>
                  );
                })()}
              </div>
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
        <div className="bg-white rounded-lg border p-4 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-3">
            <div>
            <h3 className="text-lg font-semibold text-gray-900">Repayment Schedule</h3>
              {loan && (loan.repayment_frequency || loan.meta?.repayment_frequency) && (
                <p className="text-sm text-gray-600 mt-1">
                  Scheduled by <span className="font-medium text-gray-800">
                    {Array.isArray(loan.repayment_frequency) ? loan.repayment_frequency[0] : (loan.repayment_frequency || loan.meta?.repayment_frequency || 'Monthly')}
                  </span>
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {schedule && schedule.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    // Find the first pending segment or use the first segment
                    const pendingSegment = schedule.find(s => s.repayment_status === 'Pending');
                    if (pendingSegment) {
                      openPaymentModal(pendingSegment);
                    } else if (schedule.length > 0) {
                      openPaymentModal(schedule[0]);
                    }
                  }}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Register Payment"
                >
                  Register Payment
                </button>
              )}
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
          {scheduleLoading ? (
            <div className="text-gray-600 text-sm py-4 text-center">
              <div className="inline-flex items-center">
                <svg className="animate-spin h-5 w-5 text-blue-600 mr-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Calculating schedule...
              </div>
            </div>
          ) : (!schedule || schedule.length===0) ? (
            <div className="text-gray-600 text-sm py-4 text-center">
              <p>Repayment schedule will be generated automatically when the loan is created.</p>
              <p className="text-xs text-gray-500 mt-2">If the schedule doesn't appear, please refresh the page.</p>
            </div>
          ) : (
            <div className="w-full border border-gray-200 rounded" style={{ maxHeight: '600px', overflow: 'auto' }}>
              <table className="divide-y divide-gray-200 text-xs w-full" style={{ minWidth: '1200px' }}>
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-2 py-2 text-center">#</th>
                    <th className="px-2 py-2 text-left">Start Date</th>
                    <th className="px-2 py-2 text-left">End Date</th>
                    <th className="px-2 py-2 text-left">Paid Date</th>
                    <th className="px-2 py-2 text-center">Days</th>
                    <th className="px-2 py-2 text-right">Start Balance</th>
                    <th className="px-2 py-2 text-right">Interest</th>
                    <th className="px-2 py-2 text-right">Principal</th>
                    <th className="px-2 py-2 text-right">Total Payment</th>
                    <th className="px-2 py-2 text-right">Outstanding Interest</th>
                    <th className="px-2 py-2 text-right">Paid Interest</th>
                    <th className="px-2 py-2 text-right">Paid Principal</th>
                    <th className="px-2 py-2 text-right">Paid Total Payment</th>
                    <th className="px-2 py-2 text-right">Remain Balance</th>
                    <th className="px-2 py-2 text-center">Status</th>
                    <th className="px-3 py-2 text-left min-w-[250px] w-64">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {schedule.map((r, index) => {
                    // Determine status and badge color - USE DATABASE STATUS
                    const originalStatus = String(r.repayment_status || 'Pending').trim();
                    
                    // Determine display status - ONLY 2 STATUSES:
                    // 1. Pending - gray (no payment made)
                    // 2. Paid - green (payment made)
                    let displayStatus = 'Pending';
                    let statusClass = 'bg-gray-100 text-gray-800';
                    
                    // Check if payment has been made - check payment data first
                    const hasPayment = (r.total_payment && parseFloat(r.total_payment) > 0) 
                      || (r.paid_date && r.paid_date.trim() !== '' && r.paid_date !== '-')
                      || (r.paid_interest && parseFloat(r.paid_interest) > 0)
                      || (r.paid_principles && parseFloat(r.paid_principles) > 0)
                      || (originalStatus.toLowerCase() === 'paid');
                    
                    if (hasPayment) {
                      // Payment has been made - show as Paid with green badge
                      displayStatus = 'Paid';
                        statusClass = 'bg-green-100 text-green-800';
                    } else {
                      // No payment made - show as Pending with gray badge
                      displayStatus = 'Pending';
                      statusClass = 'bg-gray-100 text-gray-800';
                    }
                    
                    // Use values from database, with fallback calculation for backward compatibility
                    const scheduledPrincipal = r.scheduled_principal !== undefined 
                      ? (r.scheduled_principal || 0)
                      : ((r.start_balance || 0) - (r.remain_balance || 0));
                    
                    const scheduledTotalPayment = r.scheduled_total_payment !== undefined
                      ? (r.scheduled_total_payment || 0)
                      : ((r.accrued_interest || 0) + scheduledPrincipal);
                    
                    return (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-2 py-1 text-center">{index + 1}</td>
                        <td className="px-2 py-1">{r.segment_start || '-'}</td>
                        <td className="px-2 py-1">{r.segment_end || '-'}</td>
                        <td className="px-2 py-1">{r.paid_date || '-'}</td>
                        <td className="px-2 py-1 text-center">{r.loan_days || 0}</td>
                        <td className="px-2 py-1 text-right">{getCurrencySymbol(currency)}{(r.start_balance || 0).toFixed(2)}</td>
                        <td className="px-2 py-1 text-right">{getCurrencySymbol(currency)}{(r.accrued_interest || 0).toFixed(2)}</td>
                        <td className="px-2 py-1 text-right">{getCurrencySymbol(currency)}{scheduledPrincipal.toFixed(2)}</td>
                        <td className="px-2 py-1 text-right font-medium">{getCurrencySymbol(currency)}{scheduledTotalPayment.toFixed(2)}</td>
                        <td className="px-2 py-1 text-right">{getCurrencySymbol(currency)}{(r.outstanding_interest || 0).toFixed(2)}</td>
                        <td className="px-2 py-1 text-right">{getCurrencySymbol(currency)}{(r.paid_interest || 0).toFixed(2)}</td>
                        <td className="px-2 py-1 text-right">{getCurrencySymbol(currency)}{(r.paid_principles || 0).toFixed(2)}</td>
                        <td className="px-2 py-1 text-right font-medium">{getCurrencySymbol(currency)}{(r.total_payment || 0).toFixed(2)}</td>
                        <td className="px-2 py-1 text-right font-medium">{getCurrencySymbol(currency)}{(r.remain_balance || 0).toFixed(2)}</td>
                        <td className="px-2 py-1 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${statusClass}`}>
                            {displayStatus}
                          </span>
                        </td>
                        <td className="px-3 py-1 text-xs text-gray-600 min-w-[250px] w-64 break-words">{r.repayment_note || '-'}</td>
                    </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-100 border-t-2 border-gray-300 font-semibold">
                  <tr>
                    <td className="px-2 py-2 text-center" colSpan="5">TOTAL</td>
                    <td className="px-2 py-2 text-right">{getCurrencySymbol(currency)}{(schedule[0]?.start_balance || 0).toFixed(2)}</td>
                    <td className="px-2 py-2 text-right">{getCurrencySymbol(currency)}{schedule.reduce((sum, r) => sum + (parseFloat(r.accrued_interest) || 0), 0).toFixed(2)}</td>
                    <td className="px-2 py-2 text-right">{getCurrencySymbol(currency)}{schedule.reduce((sum, r) => {
                      const scheduledPrincipal = r.scheduled_principal !== undefined 
                        ? (r.scheduled_principal || 0)
                        : ((r.start_balance || 0) - (r.remain_balance || 0));
                      return sum + scheduledPrincipal;
                    }, 0).toFixed(2)}</td>
                    <td className="px-2 py-2 text-right">{getCurrencySymbol(currency)}{schedule.reduce((sum, r) => {
                      const scheduledPrincipal = r.scheduled_principal !== undefined 
                        ? (r.scheduled_principal || 0)
                        : ((r.start_balance || 0) - (r.remain_balance || 0));
                      const scheduledTotalPayment = r.scheduled_total_payment !== undefined
                        ? (r.scheduled_total_payment || 0)
                        : ((r.accrued_interest || 0) + scheduledPrincipal);
                      return sum + scheduledTotalPayment;
                    }, 0).toFixed(2)}</td>
                    <td className="px-2 py-2 text-right">{getCurrencySymbol(currency)}{schedule.reduce((sum, r) => sum + (parseFloat(r.outstanding_interest) || 0), 0).toFixed(2)}</td>
                    <td className="px-2 py-2 text-right">{getCurrencySymbol(currency)}{schedule.reduce((sum, r) => sum + (parseFloat(r.paid_interest) || 0), 0).toFixed(2)}</td>
                    <td className="px-2 py-2 text-right">{getCurrencySymbol(currency)}{schedule.reduce((sum, r) => sum + (parseFloat(r.paid_principles) || 0), 0).toFixed(2)}</td>
                    <td className="px-2 py-2 text-right">{getCurrencySymbol(currency)}{schedule.reduce((sum, r) => sum + (parseFloat(r.total_payment) || 0), 0).toFixed(2)}</td>
                    <td className="px-2 py-2 text-right">{getCurrencySymbol(currency)}{(schedule[schedule.length - 1]?.remain_balance || 0).toFixed(2)}</td>
                    <td className="px-2 py-2 text-center" colSpan="2"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          
          {/* Payment History Section */}
          <div className="mt-6 border-t pt-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-3">
              <h3 className="text-lg font-semibold text-gray-900">Payment History</h3>
              <button
                type="button"
                onClick={downloadPaymentHistoryCsv}
                disabled={!paymentHistory || paymentHistory.length === 0}
                className="px-3 py-1.5 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Download Payment History CSV"
              >
                Download Payment History CSV
              </button>
            </div>
            {paymentHistoryLoading ? (
              <div className="text-center py-4 text-gray-500">Loading payment history...</div>
            ) : paymentHistory && paymentHistory.length > 0 ? (
              <div className="w-full border border-gray-200 rounded" style={{ maxHeight: '400px', overflow: 'auto' }}>
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-2 py-2 text-left font-semibold text-gray-700">ID</th>
                      <th className="px-2 py-2 text-left font-semibold text-gray-700">Segment Start</th>
                      <th className="px-2 py-2 text-left font-semibold text-gray-700">Segment End</th>
                      <th className="px-2 py-2 text-left font-semibold text-gray-700">Payment Date</th>
                      <th className="px-2 py-2 text-center font-semibold text-gray-700">Loan Days</th>
                      <th className="px-2 py-2 text-center font-semibold text-gray-700">Paid Loan Days</th>
                      <th className="px-2 py-2 text-right font-semibold text-gray-700">Paid Interest</th>
                      <th className="px-2 py-2 text-right font-semibold text-gray-700">Paid Principal</th>
                      <th className="px-2 py-2 text-right font-semibold text-gray-700">Total Payment</th>
                      <th className="px-2 py-2 text-right font-semibold text-gray-700">Balance Before</th>
                      <th className="px-2 py-2 text-right font-semibold text-gray-700">Balance After</th>
                      <th className="px-2 py-2 text-right font-semibold text-gray-700">Outstanding Int. Before</th>
                      <th className="px-2 py-2 text-right font-semibold text-gray-700">Outstanding Int. After</th>
                      <th className="px-2 py-2 text-left font-semibold text-gray-700">Note</th>
                      <th className="px-2 py-2 text-left font-semibold text-gray-700">Created At</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paymentHistory.map((h, idx) => (
                      <tr key={h.id || idx} className="hover:bg-gray-50">
                        <td className="px-2 py-1">{h.id}</td>
                        <td className="px-2 py-1">{(h.segment_start && h.segment_start !== '0000-00-00') ? h.segment_start : '-'}</td>
                        <td className="px-2 py-1">{(h.segment_end && h.segment_end !== '0000-00-00') ? h.segment_end : '-'}</td>
                        <td className="px-2 py-1">{h.payment_date || '-'}</td>
                        <td className="px-2 py-1 text-center">{h.loan_days || 0}</td>
                        <td className="px-2 py-1 text-center">{h.paid_loan_days || 0}</td>
                        <td className="px-2 py-1 text-right">{getCurrencySymbol(currency)}{(h.paid_interest || 0).toFixed(2)}</td>
                        <td className="px-2 py-1 text-right">{getCurrencySymbol(currency)}{(h.paid_principal || 0).toFixed(2)}</td>
                        <td className="px-2 py-1 text-right font-medium">{getCurrencySymbol(currency)}{(h.total_payment || 0).toFixed(2)}</td>
                        <td className="px-2 py-1 text-right">{getCurrencySymbol(currency)}{(h.balance_before || 0).toFixed(2)}</td>
                        <td className="px-2 py-1 text-right">{getCurrencySymbol(currency)}{(h.balance_after || 0).toFixed(2)}</td>
                        <td className="px-2 py-1 text-right">{getCurrencySymbol(currency)}{(h.outstanding_interest_before || 0).toFixed(2)}</td>
                        <td className="px-2 py-1 text-right">{getCurrencySymbol(currency)}{(h.outstanding_interest_after || 0).toFixed(2)}</td>
                        <td className="px-2 py-1 text-xs text-gray-600 min-w-[150px] break-words">{h.note || '-'}</td>
                        <td className="px-2 py-1 text-xs text-gray-600">{h.created_at ? new Date(h.created_at).toLocaleString() : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">No payment history available</div>
            )}
          </div>
          
          {/* Payment Registration Modal */}
          {showPaymentModal && selectedSegment && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] flex flex-col">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Register Payment</h3>
                <div className="space-y-4 overflow-y-auto flex-1 pr-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Segment ID</label>
                    <input
                      type="text"
                      value={selectedSegment.id}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                      <input
                        type="text"
                        value={selectedSegment.segment_start || '-'}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                      <input
                        type="text"
                        value={selectedSegment.segment_end || '-'}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Repayment Status</label>
                    <div className="flex items-center">
                      {(() => {
                        const originalStatus = String(selectedSegment.repayment_status || 'Pending').trim();
                        
                        // Check if payment has been made - check payment data first
                        const hasPayment = (selectedSegment.total_payment && parseFloat(selectedSegment.total_payment) > 0) 
                          || (selectedSegment.paid_date && selectedSegment.paid_date.trim() !== '' && selectedSegment.paid_date !== '-')
                          || (selectedSegment.paid_interest && parseFloat(selectedSegment.paid_interest) > 0)
                          || (selectedSegment.paid_principles && parseFloat(selectedSegment.paid_principles) > 0)
                          || (originalStatus.toLowerCase() === 'paid');
                        
                        let displayStatus = 'Pending';
                        let statusClass = 'bg-gray-100 text-gray-800';
                        
                        // ONLY 2 STATUSES:
                        // 1. "Paid" (GREEN): Payment has been made
                        // 2. "Pending" (GRAY): No payment made
                        
                        if (hasPayment) {
                          displayStatus = 'Paid';
                          statusClass = 'bg-green-100 text-green-800';
                        } else {
                          displayStatus = 'Pending';
                          statusClass = 'bg-gray-100 text-gray-800';
                        }
                        
                        return (
                          <span className={`px-2 py-1 rounded text-xs font-medium ${statusClass}`}>
                            {displayStatus}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Remain Balance</label>
                    <input
                      type="text"
                      value={`${getCurrencySymbol(currency)}${(selectedSegment.remain_balance || 0).toFixed(2)}`}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date <span className="text-red-500">*</span></label>
                    <input
                      type="date"
                      value={paymentForm.payment_date}
                      onChange={(e) => {
                        const selectedDate = e.target.value;
                        // Find the latest payment date from all segments
                        let latestPaymentDate = null;
                        if (schedule && schedule.length > 0) {
                          schedule.forEach(s => {
                            if (s.paid_date && s.paid_date.trim() !== '' && s.paid_date !== '-') {
                              const paidDate = new Date(s.paid_date);
                              if (!latestPaymentDate || paidDate > latestPaymentDate) {
                                latestPaymentDate = paidDate;
                              }
                            }
                          });
                        }
                        
                        // Validate: payment date must be after latest payment date
                        if (latestPaymentDate) {
                          const latestDateStr = latestPaymentDate.toISOString().split('T')[0];
                          if (selectedDate <= latestDateStr) {
                            alert(`Payment date must be after the last payment date (${latestDateStr}). Please select a later date.`);
                            return;
                          }
                        }
                        setPaymentForm({...paymentForm, payment_date: selectedDate});
                      }}
                      min={(() => {
                        // Set minimum date to day after latest payment
                        let latestPaymentDate = null;
                        if (schedule && schedule.length > 0) {
                          schedule.forEach(s => {
                            if (s.paid_date && s.paid_date.trim() !== '' && s.paid_date !== '-') {
                              const paidDate = new Date(s.paid_date);
                              if (!latestPaymentDate || paidDate > latestPaymentDate) {
                                latestPaymentDate = paidDate;
                              }
                            }
                          });
                        }
                        if (latestPaymentDate) {
                          const nextDay = new Date(latestPaymentDate);
                          nextDay.setDate(nextDay.getDate() + 1);
                          return nextDay.toISOString().split('T')[0];
                        }
                        return '';
                      })()}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">Required - Must be after last payment date</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Interest (Available)</label>
                    <input
                      type="text"
                      value={(() => {
                        const paymentDateStr = paymentForm.payment_date || selectedSegment.paid_date || selectedSegment.segment_start;
                        const interestAvailable = calculateMaxAvailableInterest(selectedSegment, paymentDateStr);
                        return `${getCurrencySymbol(currency)}${interestAvailable.toFixed(2)}`;
                      })()}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                    />
                    <p className="text-xs text-gray-500 mt-1">Remaining scheduled interest + outstanding interest + extended period interest (if payment date is after segment end)</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Principal (Remaining)</label>
                    <input
                      type="text"
                      value={`${getCurrencySymbol(currency)}${(selectedSegment.remain_balance || 0).toFixed(2)}`}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                    />
                    <p className="text-xs text-gray-500 mt-1">Current remaining balance to pay</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Total Payment (Scheduled)</label>
                    <input
                      type="text"
                      value={`${getCurrencySymbol(currency)}${((selectedSegment.scheduled_total_payment || 0) || ((selectedSegment.accrued_interest || 0) + (selectedSegment.scheduled_principal || 0))).toFixed(2)}`}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Outstanding Interest</label>
                    <input
                      type="text"
                      value={`${getCurrencySymbol(currency)}${(selectedSegment.outstanding_interest || 0).toFixed(2)}`}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                    />
                    <p className="text-xs text-gray-500 mt-1">Previous unpaid interest that should be settled</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Interest Payment</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={(() => {
                        const paymentDateStr = paymentForm.payment_date || selectedSegment.paid_date || selectedSegment.segment_start;
                        return calculateMaxAvailableInterest(selectedSegment, paymentDateStr).toFixed(2);
                      })()}
                      value={paymentForm.paid_interest}
                      onChange={(e) => {
                        const enteredValue = parseFloat(e.target.value) || 0;
                        const paymentDateStr = paymentForm.payment_date || selectedSegment.paid_date || selectedSegment.segment_start;
                        const maxInterest = calculateMaxAvailableInterest(selectedSegment, paymentDateStr);
                        
                        // Validate: cannot exceed maximum available interest
                        if (enteredValue > maxInterest) {
                          setPaymentFormErrors({...paymentFormErrors, paid_interest: `Interest payment cannot exceed the available interest amount (${getCurrencySymbol(currency)}${maxInterest.toFixed(2)}). Please enter a value less than or equal to this amount.`});
                        } else {
                          setPaymentFormErrors({...paymentFormErrors, paid_interest: ''});
                        }
                        
                        setPaymentForm({...paymentForm, paid_interest: e.target.value});
                      }}
                      className={`w-full px-3 py-2 border rounded-md ${paymentFormErrors.paid_interest ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'}`}
                      placeholder="Enter interest amount (0 if no interest)"
                    />
                    {paymentFormErrors.paid_interest ? (
                      <p className="text-xs text-red-500 mt-1">{paymentFormErrors.paid_interest}</p>
                    ) : (
                      <p className="text-xs text-gray-500 mt-1">Enter 0 if no interest payment, or amount up to available interest ({getCurrencySymbol(currency)}{(() => {
                        const paymentDateStr = paymentForm.payment_date || selectedSegment.paid_date || selectedSegment.segment_start;
                        return calculateMaxAvailableInterest(selectedSegment, paymentDateStr).toFixed(2);
                      })()})</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Principal Payment</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={paymentForm.paid_principles}
                      onChange={(e) => setPaymentForm({...paymentForm, paid_principles: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="Enter principal amount (0 if no principal)"
                    />
                    <p className="text-xs text-gray-500 mt-1">Enter 0 if no principal payment, or amount to pay</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                    <textarea
                      value={paymentForm.repayment_note}
                      onChange={(e) => setPaymentForm({...paymentForm, repayment_note: e.target.value})}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="Payment notes..."
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <button
                    onClick={() => {
                      setShowPaymentModal(false);
                      setSelectedSegment(null);
                    }}
                    className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                    disabled={paymentLoading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={registerPayment}
                    disabled={paymentLoading}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {paymentLoading ? 'Registering...' : 'Register Payment'}
                  </button>
                </div>
              </div>
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
                      <a href={m.source_url} target="_blank" rel="noopener noreferrer" download className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50">Download</a>
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

      {activeTab === 'Collateral' && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Collateral</h3>
          {collateralMedia ? (
            <ul className="divide-y divide-gray-200 rounded-md border border-gray-200">
              <li className="flex items-center justify-between px-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="truncate text-gray-900">{collateralMedia.title?.rendered || collateralMedia.filename || `File #${collateralMedia.id}`}</div>
                  <div className="text-xs text-gray-500">{collateralMedia.mime_type || collateralMedia.post_mime_type}</div>
                </div>
                {collateralMedia.source_url && (
                  <div className="flex items-center gap-2">
                    <a href={collateralMedia.source_url} target="_blank" rel="noopener noreferrer" className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50">View</a>
                    <a href={collateralMedia.source_url} target="_blank" rel="noopener noreferrer" download className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50">Download</a>
                  </div>
                )}
              </li>
            </ul>
          ) : (
            <div className="text-sm text-gray-600">No collateral uploaded.</div>
          )}
        </div>
      )}

      {activeTab === 'Contract' && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Loan Contract</h3>
          {contractMedia ? (
            <ul className="divide-y divide-gray-200 rounded-md border border-gray-200">
              <li className="flex items-center justify-between px-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="truncate text-gray-900">{contractMedia.title?.rendered || contractMedia.filename || `File #${contractMedia.id}`}</div>
                  <div className="text-xs text-gray-500">{contractMedia.mime_type || contractMedia.post_mime_type}</div>
                </div>
                {contractMedia.source_url && (
                  <div className="flex items-center gap-2">
                    <a href={contractMedia.source_url} target="_blank" rel="noopener noreferrer" className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50">View</a>
                    <a href={contractMedia.source_url} target="_blank" rel="noopener noreferrer" download className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50">Download</a>
                  </div>
                )}
              </li>
            </ul>
          ) : (
            <div className="text-sm text-gray-600">No loan contract uploaded.</div>
          )}
        </div>
      )}

      {activeTab !== 'Summary' && activeTab !== 'Repayment Schedule' && activeTab !== 'Note' && activeTab !== 'Bank Statements' && activeTab !== 'Collateral' && activeTab !== 'Contract' && (
        <div className="bg-white rounded-lg border p-8 text-center text-gray-500">{activeTab} coming soon.</div>
      )}
    </div>
  );
};

export default LoansDetail;


