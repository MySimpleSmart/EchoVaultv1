import React, { useEffect, useMemo, useState } from 'react';
import ConfirmationModal from './components/ConfirmationModal';
import SuccessMessage from './components/SuccessMessage';
import { getVerificationStatus } from './utils/verification';

const apiBase = (typeof window !== 'undefined' && window.REACT_APP_API_URL) || process.env.REACT_APP_API_URL || `${window.location.origin}/wp-json`;
const getCurrencySymbol = (c) => (c === 'MNT' ? '₮' : '$');
const getWpAdminBase = () => {
  const envBase = (typeof window !== 'undefined' && (window.REACT_APP_WP_ADMIN_BASE || window.REACT_APP_SITE_URL)) || process.env.REACT_APP_WP_ADMIN_BASE || process.env.REACT_APP_SITE_URL;
  if (envBase) {
    const trimmed = envBase.replace(/\/$/, '');
    return `${trimmed}/wp-admin`;
  }
  try {
    const u = new URL(window.location.origin);
    u.hostname = u.hostname.replace(/^app\./, '');
    return `${u.origin}/wp-admin`;
  } catch (_) {
    return '/wp-admin';
  }
};

// Helper to extract ID from various formats (array/object/number/string)
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

const CreateLoan = ({ token, setCurrentView, onOpenBorrower, editingLoan }) => {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState({ show: false, message: '', type: 'success' });
  const [step, setStep] = useState(1);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [pendingExitAction, setPendingExitAction] = useState(null);
  const [isLoadingEditData, setIsLoadingEditData] = useState(false);

  const [borrowers, setBorrowers] = useState([]);
  const [products, setProducts] = useState([]);
  const [systemAccounts, setSystemAccounts] = useState([]);

  const [bankStatements, setBankStatements] = useState([]);
  const [bankStatementsError, setBankStatementsError] = useState('');
  const [collateralFile, setCollateralFile] = useState(null);
  const [loanContractFile, setLoanContractFile] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [apiSchedule, setApiSchedule] = useState([]);
  const [apiTestLoading, setApiTestLoading] = useState(false);
  const [apiTestError, setApiTestError] = useState('');
  const [apiTestSuccess, setApiTestSuccess] = useState(false);

  const [form, setForm] = useState({
    loan_id: 'EL-0000001',
    borrower: '',
    co_borrower_status: 'No',
    co_borrower: '',
    loan_product: '',
    loan_currency: '',
    loan_interest: '',
    loan_term: '',
    loan_amount: '',
    repayment_method: 'Equal Principal',
    repayment_frequency: 'Monthly',
    repayment_type: 'Graphical',
    loan_status: 'Draft',
    start_date: '',
    end_date: '',
    loan_disbursement_account: '',
    loan_repayment_account: '',
    loan_note: ''
  });

  const activeProducts = useMemo(() => products.filter(p => {
    let s = p.product_status; if (Array.isArray(s)) s = s[0];
    return (s || '').toString().toLowerCase() === 'active';
  }), [products]);

  const verifiedBorrowers = useMemo(() => borrowers.filter(b => getVerificationStatus(b).status === 'Verified'), [borrowers]);

  const activeSystemAccounts = useMemo(() => systemAccounts.filter(a => {
    let s = a.account_status; if (Array.isArray(s)) s = s[0];
    return s === true || (s || '').toString().toLowerCase() === 'active';
  }), [systemAccounts]);

  const selectedProduct = useMemo(() => activeProducts.find(p => String(p.id) === String(form.loan_product)), [activeProducts, form.loan_product]);
  const borrowerObj = useMemo(() => borrowers.find(b => String(b.id) === String(form.borrower)), [borrowers, form.borrower]);
  const coBorrowerOptions = useMemo(() => borrowers.filter(b => String(b.id) !== String(form.borrower)), [borrowers, form.borrower]);

  const isDirty = useMemo(() => {
    return (
      !!form.borrower || !!form.loan_product || !!form.loan_term || !!form.loan_amount || !!form.start_date ||
      !!form.loan_disbursement_account || !!form.loan_repayment_account || !!form.loan_note || !!collateralFile || !!loanContractFile
    );
  }, [form, collateralFile, loanContractFile]);

  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  const attemptExit = (action) => {
    if (isDirty) {
      setPendingExitAction(() => action);
      setShowExitConfirm(true);
    } else {
      action();
    }
  };

  useEffect(() => {
    if (!token) return;
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const headers = { 'Authorization': `Bearer ${token}` };
        const [bRes, pRes, sRes, lRes] = await Promise.all([
          fetch(`${apiBase}/wp/v2/borrower-profile?per_page=100&context=edit`, { headers, mode: 'cors' }),
          fetch(`${apiBase}/wp/v2/loan-product?per_page=100&context=edit&status=publish,draft`, { headers, mode: 'cors' }),
          fetch(`${apiBase}/wp/v2/bank-account-system?per_page=100&status=publish,draft`, { headers, mode: 'cors' }),
          fetch(`${apiBase}/wp/v2/loans?per_page=100&status=publish,draft`, { headers, mode: 'cors' })
        ]);
        if (!bRes.ok) throw new Error('Failed to load borrowers');
        if (!pRes.ok) throw new Error('Failed to load products');
        if (!sRes.ok) throw new Error('Failed to load system accounts');
        if (!lRes.ok) throw new Error('Failed to load loans');
        const [bJson, pJson, sJson, loansJson] = await Promise.all([bRes.json(), pRes.json(), sRes.json(), lRes.json()]);
        if (!mounted) return;
        setBorrowers(bJson || []);
        setProducts(pJson || []);
        setSystemAccounts(sJson || []);
        // Compute next Loan ID (EL-XXXXXXX)
        try {
          let maxNum = 0;
          (loansJson || []).forEach(l => {
            const lid = String(l.loan_id || (l.meta && l.meta.loan_id) || '').trim();
            const m = lid.match(/^EL-(\d{1,})$/);
            if (m) {
              const n = parseInt(m[1], 10);
              if (!Number.isNaN(n) && n > maxNum) maxNum = n;
            }
          });
          const next = String(maxNum + 1).padStart(7, '0');
          setForm(prev => ({ ...prev, loan_id: `EL-${next}` }));
        } catch (_) {}
      } catch (e) {
        if (!mounted) return;
        setError(e.message || 'Failed to load data');
      } finally {
        mounted && setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [token]);

  useEffect(() => {
    // Skip auto-filling if we're loading edit data
    if (isLoadingEditData) return;
    
    if (selectedProduct) {
      setForm(prev => ({ ...prev, loan_currency: selectedProduct.currency || 'AUD', loan_interest: selectedProduct.interest_rate || '' }));
    } else {
      setForm(prev => ({ ...prev, loan_currency: '', loan_interest: '' }));
    }
  }, [selectedProduct, isLoadingEditData]);

  // Load existing loan data when editingLoan prop is provided
  useEffect(() => {
    if (!editingLoan || !borrowers.length || !products.length || !systemAccounts.length) return;
    
    setIsLoadingEditData(true);
    try {
      const loan = editingLoan;
      
      // Extract IDs using toId helper
      const borrowerId = toId(loan.meta?.borrower_id) || toId(loan.borrower);
      const coBorrowerId = toId(loan.meta?.co_borrower_id) || toId(loan.co_borrower) || '';
      
      // Try to get product ID - first from meta, then lookup by name
      let productId = toId(loan.meta?.loan_product_id);
      if (!productId && loan.loan_product) {
        const productName = Array.isArray(loan.loan_product) ? loan.loan_product[0] : loan.loan_product;
        const foundProduct = products.find(p => String(p.product_name) === String(productName));
        if (foundProduct) productId = String(foundProduct.id);
      }
      
      // Try to get repayment account ID - first from meta, then lookup by label
      let repaymentAccountId = toId(loan.meta?.repayment_account_id);
      if (!repaymentAccountId && loan.loan_repayment_account) {
        const repayLabel = Array.isArray(loan.loan_repayment_account) ? loan.loan_repayment_account[0] : loan.loan_repayment_account;
        // Try to find system account that matches the label
        for (const acc of systemAccounts) {
          const country = Array.isArray(acc.account_type) ? acc.account_type[0] : acc.account_type;
          const bankName = country === 'Australia'
            ? (Array.isArray(acc.bank_name_au) ? acc.bank_name_au[0] : acc.bank_name_au)
            : (Array.isArray(acc.bank_name_mn) ? acc.bank_name_mn[0] : acc.bank_name_mn);
          const accLabel = `${acc.account_name || ''} • ${bankName || ''} • ${acc.account_number || ''}${acc.bsb ? ` • BSB ${acc.bsb}` : ''}`;
          if (accLabel && repayLabel && accLabel.trim() === repayLabel.trim()) {
            repaymentAccountId = String(acc.id);
            break;
          }
        }
      }
      
      // Reconstruct disbursement account JSON from borrower data
      let disbAccountJson = '';
      const borrowerObj = borrowers.find(b => String(b.id) === String(borrowerId));
      if (borrowerObj && (borrowerObj.account_name || borrowerObj.account_number)) {
        const country = borrowerObj.account_type || borrowerObj.bank_country || '';
        const bankName = country === 'Mongolia' 
          ? (borrowerObj.bank_name_mn || borrowerObj.bank_name)
          : (borrowerObj.bank_name || borrowerObj.bank_name_au);
        
        disbAccountJson = JSON.stringify({
          accountName: borrowerObj.account_name || '',
          bankName: bankName || '',
          bsb: borrowerObj.bsb_number || borrowerObj.bsb || '',
          accountNumber: borrowerObj.account_number || ''
        });
      }
      
      // Load loan data into form
      setForm({
        loan_id: loan.loan_id || loan.meta?.loan_id || 'EL-0000001',
        borrower: borrowerId,
        co_borrower_status: Array.isArray(loan.co_borrower_status) ? loan.co_borrower_status[0] : (loan.co_borrower_status || 'No'),
        co_borrower: coBorrowerId,
        loan_product: productId,
        loan_currency: Array.isArray(loan.loan_currency) ? loan.loan_currency[0] : (loan.loan_currency || ''),
        loan_interest: Array.isArray(loan.loan_interest) ? loan.loan_interest[0] : (loan.loan_interest || ''),
        loan_term: Array.isArray(loan.loan_term) ? loan.loan_term[0] : (loan.loan_term || ''),
        loan_amount: Array.isArray(loan.loan_amount) ? loan.loan_amount[0] : (loan.loan_amount || ''),
        repayment_method: Array.isArray(loan.repayment_method) ? loan.repayment_method[0] : (loan.repayment_method || 'Equal Principal'),
        repayment_frequency: Array.isArray(loan.repayment_frequency) ? loan.repayment_frequency[0] : (loan.repayment_frequency || 'Monthly'),
        repayment_type: Array.isArray(loan.repayment_type) ? loan.repayment_type[0] : (loan.repayment_type || 'Graphical'),
        loan_status: Array.isArray(loan.loan_status) ? loan.loan_status[0] : (loan.loan_status || 'Draft'),
        start_date: loan.start_date || '',
        end_date: loan.end_date || '',
        loan_disbursement_account: disbAccountJson,
        loan_repayment_account: repaymentAccountId,
        loan_note: loan.loan_note || ''
      });
      
      // Load bank statements if they exist
      if (loan.meta?.bank_statement || loan.fields?.bank_statement || loan.bank_statement) {
        const bankStatData = loan.bank_statement || loan.meta?.bank_statement || loan.fields?.bank_statement;
        if (Array.isArray(bankStatData) && bankStatData.length > 0) {
          // Check if items are already full media objects
          if (typeof bankStatData[0] === 'object' && bankStatData[0].ID) {
            // Already full objects, use directly
            setBankStatements(bankStatData);
          } else {
            // String URLs or IDs, need to fetch
            const rawIds = bankStatData;
            const ids = rawIds.map(id => toId(id)).filter(Boolean);
            if (ids.length > 0) {
              const fetchBankStatements = async () => {
                try {
                  const mediaPromises = ids.map(id => 
                    fetch(`${apiBase}/wp/v2/media/${id}`, {
                      headers: { 'Authorization': `Bearer ${token}` },
                      mode: 'cors'
                    }).then(r => r.ok ? r.json() : null)
                  );
                  const mediaData = await Promise.all(mediaPromises);
                  setBankStatements(mediaData.filter(Boolean));
                } catch (e) {
                  console.error('Failed to load bank statements:', e);
                }
              };
              fetchBankStatements();
            }
          }
        }
      }
      
      // Load collateral file if it exists
      const collateralId = toId(loan.meta?.collateral || loan.fields?.collateral || loan.collateral);
      if (collateralId) {
        const fetchCollateral = async () => {
          try {
            const colResp = await fetch(`${apiBase}/wp/v2/media/${collateralId}`, {
              headers: { 'Authorization': `Bearer ${token}` },
              mode: 'cors'
            });
            if (colResp.ok) {
              const colData = await colResp.json();
              setCollateralFile(colData);
            }
          } catch (e) {
            console.error('Failed to load collateral:', e);
          }
        };
        fetchCollateral();
      }
      
      // Load loan contract file if it exists
      const contractId = toId(loan.meta?.loan_contract || loan.fields?.loan_contract || loan.loan_contract);
      if (contractId) {
        const fetchContract = async () => {
          try {
            const conResp = await fetch(`${apiBase}/wp/v2/media/${contractId}`, {
              headers: { 'Authorization': `Bearer ${token}` },
              mode: 'cors'
            });
            if (conResp.ok) {
              const conData = await conResp.json();
              setLoanContractFile(conData);
            }
          } catch (e) {
            console.error('Failed to load loan contract:', e);
          }
        };
        fetchContract();
      }
      
    } catch (err) {
      console.error('Error loading editing loan:', err);
      setError('Failed to load loan data for editing');
    } finally {
      setIsLoadingEditData(false);
    }
  }, [editingLoan, borrowers, products, systemAccounts, token]);

  // Ensure co-borrower cannot be the same as the main borrower or remain set when status is No
  useEffect(() => {
    setForm(prev => {
      if (prev.co_borrower_status !== 'Yes' && prev.co_borrower) {
        return { ...prev, co_borrower: '' };
      }
      if (prev.co_borrower && String(prev.co_borrower) === String(prev.borrower)) {
        return { ...prev, co_borrower: '' };
      }
      return prev;
    });
  }, [form.borrower, form.co_borrower_status]);

  useEffect(() => {
    if (form.start_date && form.loan_term) {
      const months = Number(form.loan_term);
      if (!Number.isNaN(months) && months > 0) {
        const start = new Date(form.start_date);
        const end = new Date(start);
        end.setMonth(end.getMonth() + months);
        const yyyy = end.getFullYear();
        const mm = String(end.getMonth() + 1).padStart(2, '0');
        const dd = String(end.getDate()).padStart(2, '0');
        setForm(prev => ({ ...prev, end_date: `${yyyy}-${mm}-${dd}` }));
      }
    } else {
      setForm(prev => ({ ...prev, end_date: '' }));
    }
  }, [form.start_date, form.loan_term]);

  const minTerm = selectedProduct?.term_min || '';
  const maxTerm = selectedProduct?.term_max || '';
  const minAmount = selectedProduct?.min_amount || '';
  const maxAmount = selectedProduct?.max_amount || '';
  const termMinNum = Number(minTerm || 0);
  const termMaxNum = Number(maxTerm || 0);
  const amountMinNum = Number(minAmount || 0);
  const amountMaxNum = Number(maxAmount || 0);
  const termOutOfRange =
    (form.loan_term !== '' && form.loan_term !== null && Number(form.loan_term) > 0) && (
      (termMinNum && Number(form.loan_term) < termMinNum) ||
      (termMaxNum && Number(form.loan_term) > termMaxNum)
    );
  const amountOutOfRange =
    (form.loan_amount !== '' && form.loan_amount !== null && Number(form.loan_amount) > 0) && (
      (amountMinNum && Number(form.loan_amount) < amountMinNum) ||
      (amountMaxNum && Number(form.loan_amount) > amountMaxNum)
    );

  const borrowerDisbursementOptions = useMemo(() => {
    if (!borrowerObj) return [];
    const country = borrowerObj.account_type || borrowerObj.bank_country || '';
    const bankName = country === 'Mongolia' ? borrowerObj.bank_name_mn || borrowerObj.bank_name : borrowerObj.bank_name || borrowerObj.bank_name_au;
    const accountName = borrowerObj.account_name;
    const bsb = borrowerObj.bsb_number || borrowerObj.bsb || '';
    const accountNumber = borrowerObj.account_number;
    const label = [accountName, bankName, accountNumber, bsb && `BSB ${bsb}`].filter(Boolean).join(' • ');
    const value = JSON.stringify({ accountName, bankName, bsb, accountNumber });
    return accountNumber ? [{ label, value }] : [];
  }, [borrowerObj]);

  const onChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const onNumber = (e) => {
    const { name, value } = e.target;
    if (value === '') return setForm(prev => ({ ...prev, [name]: '' }));
    const n = Number(value);
    if (!Number.isNaN(n)) setForm(prev => ({ ...prev, [name]: n }));
  };

  // Step-by-step live validation helpers
  const hasValue = (v) => !(v === '' || v === null || v === undefined);
  const missingStep1 = () => {
    const m = [];
    if (!hasValue(form.borrower)) m.push('Borrower');
    if (!hasValue(form.loan_product)) m.push('Loan Product');
    // Validate core inputs where they are entered (step 1)
    if (!(Number(form.loan_term) > 0) || termOutOfRange) m.push('Loan Term');
    if (!(Number(form.loan_amount) > 0) || amountOutOfRange) m.push('Loan Amount');
    if (!hasValue(form.start_date)) m.push('Start Date');
    if (form.co_borrower_status === 'Yes' && !hasValue(form.co_borrower)) m.push('Co-borrower');
    return m;
  };
  const missingStep2 = () => {
    const m = [];
    if (form.co_borrower_status === 'Yes' && !hasValue(form.co_borrower)) m.push('Co-borrower');
    return m;
  };
  const missingStep3 = () => {
    const m = [];
    if (!(Number(form.loan_term) > 0)) m.push('Loan Term');
    if (!(Number(form.loan_amount) > 0)) m.push('Loan Amount');
    if (!hasValue(form.start_date)) m.push('Start Date');
    return m;
  };

  // Live field-level missing flags
  const isMissing = {
    borrower: !hasValue(form.borrower),
    loan_product: !hasValue(form.loan_product),
    loan_term: !(Number(form.loan_term) > 0) || termOutOfRange,
    loan_amount: !(Number(form.loan_amount) > 0) || amountOutOfRange,
    start_date: !hasValue(form.start_date),
    co_borrower: form.co_borrower_status === 'Yes' && !hasValue(form.co_borrower),
    loan_disbursement_account: (borrowerDisbursementOptions && borrowerDisbursementOptions.length > 0) && !hasValue(form.loan_disbursement_account),
    loan_repayment_account: !hasValue(form.loan_repayment_account)
  };
  const isStepValid = (s) => {
    if (s === 1) return missingStep1().length === 0;
    if (s === 2) return missingStep2().length === 0;
    if (s === 3) return missingStep3().length === 0;
    if (s === 4) return true; // collateral optional
    if (s === 5) return true; // contract optional
    if (s === 6) return true; // note optional
    if (s === 7) return validate() === '';
    return true;
  };

  // Replace generic validateStep message with specific per-step messages
  const validateStep = (s) => {
    if (s === 1) {
      const miss = missingStep1();
      return miss.length ? `Provide: ${miss.join(', ')}` : '';
    }
    if (s === 2) {
      const miss = missingStep2();
      return miss.length ? `Provide: ${miss.join(', ')}` : '';
    }
    if (s === 3) {
      const miss = missingStep3();
      return miss.length ? `Provide: ${miss.join(', ')}` : '';
    }
    if (s === 7) return validate();
    return '';
  };

  // Clear any old error when relevant fields or step change
  useEffect(() => {
    setError('');
  }, [step, form.borrower, form.loan_product, form.co_borrower_status, form.co_borrower, form.loan_term, form.loan_amount, form.start_date]);

  

  // Schedule helpers
  const periodsForFrequency = (months, freq) => {
    if (!months) return 0;
    const m = Number(months);
    if (freq === 'Monthly') return m;
    if (freq === 'Fortnightly') return Math.ceil((m * 12 * 2) / 12);
    if (freq === 'Weekly') return Math.ceil((m * 52) / 12);
    return m;
  };
  const ratePerPeriod = (annualPct, freq) => {
    const annual = Number(annualPct || 0) / 100;
    if (freq === 'Monthly') return annual / 12;
    if (freq === 'Fortnightly') return annual / 26;
    if (freq === 'Weekly') return annual / 52;
    return annual / 12;
  };
  const addDays = (d, days) => { const x = new Date(d); x.setDate(x.getDate() + days); return x; };
  const addMonths = (d, months) => { const x = new Date(d); x.setMonth(x.getMonth() + months); return x; };
  const nextDateFrom = (start, idx, freq) => {
    if (freq === 'Monthly') return addMonths(start, idx + 1);
    if (freq === 'Fortnightly') return addDays(start, (idx + 1) * 14);
    if (freq === 'Weekly') return addDays(start, (idx + 1) * 7);
    return addMonths(start, idx + 1);
  };

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
    const filename = `repayment_schedule_${form.loan_id || 'loan'}.csv`;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Test function to verify plugin is installed first
  const testPluginConnection = async () => {
    try {
      const testEndpoint = `${apiBase}/echovault/v2/test`;
      console.log('Testing plugin connection:', testEndpoint);
      const testResponse = await fetch(testEndpoint, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Accept': 'application/json',
        }
      });
      
      console.log('Test response status:', testResponse.status);
      console.log('Test response headers:', Object.fromEntries(testResponse.headers.entries()));
      
      if (testResponse.ok) {
        const testData = await testResponse.json();
        console.log('✅ Plugin is active:', testData);
        return true;
      } else {
        // Try to get error details
        const errorText = await testResponse.text();
        console.error('❌ Plugin test failed:', testResponse.status, testResponse.statusText, errorText);
        
        // If it's a 404, the route might not be registered yet - try the main endpoint instead
        if (testResponse.status === 404) {
          console.log('Test endpoint returned 404, trying main endpoint instead...');
          // Don't fail completely - the main endpoint might still work
          return true; // Allow to proceed, the main endpoint test will catch it
        }
        return false;
      }
    } catch (error) {
      console.error('❌ Plugin connection test failed:', error);
      // Don't block if test fails - might be CORS or network issue, but endpoint could still work
      console.log('⚠️ Test failed but continuing - will try main endpoint...');
      return true; // Allow to proceed
    }
  };

  // Test function to call the backend API
  const testApiSchedule = async () => {
    if (!form.loan_amount || !form.loan_term || !form.start_date || !selectedProduct) {
      setApiTestError('Please fill in loan amount, term, and start date first');
      return;
    }

    setApiTestLoading(true);
    setApiTestError('');
    setApiTestSuccess(false);
    setApiSchedule([]);

    try {
      // Try to test plugin connection (but don't block if it fails)
      const pluginActive = await testPluginConnection();
      if (!pluginActive) {
        console.warn('Plugin test endpoint not accessible, but continuing to try main endpoint...');
        // Don't return - continue to try the main endpoint
      }

      // Log the API endpoint being called for debugging
      const endpoint = `${apiBase}/echovault/v2/calculate-schedule`;
      console.log('Testing API endpoint:', endpoint);
      console.log('API Base URL:', apiBase);
      console.log('Token present:', !!token);
      
      const requestBody = {
        loan_amount: Number(form.loan_amount),
        loan_term: Number(form.loan_term),
        loan_interest: Number(form.loan_interest || selectedProduct?.interest_rate || 0),
        repayment_method: form.repayment_method,
        repayment_frequency: form.repayment_frequency,
        start_date: form.start_date
      };
      console.log('Request body:', requestBody);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody),
        mode: 'cors',
        credentials: 'omit' // Changed from 'include' to 'omit' when using * origin
      });
      
      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      // Check if response has content
      const contentLength = response.headers.get('content-length');
      const responseText = await response.text();
      
      console.log('Response content-length:', contentLength);
      console.log('Response text length:', responseText.length);
      console.log('Response text (first 500 chars):', responseText.substring(0, 500));

      if (!responseText || responseText.trim().length === 0) {
        throw new Error('Empty response from server. The API endpoint returned no data.');
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        console.error('Response text that failed to parse:', responseText);
        throw new Error(`Failed to parse JSON response: ${parseError.message}. Response: ${responseText.substring(0, 200)}`);
      }
      
      if (data.success && data.schedule) {
        // Convert date strings to Date objects for compatibility
        const scheduleWithDates = data.schedule.map(row => ({
          ...row,
          date: new Date(row.date)
        }));
        
        setApiSchedule(scheduleWithDates);
        setApiTestSuccess(true);
        setApiTestError('');
        
        // Compare with client-side calculation
        if (schedule.length > 0) {
          const comparison = compareSchedules(schedule, scheduleWithDates);
          if (comparison.match) {
            console.log('✅ Schedules match perfectly!', comparison);
          } else {
            console.warn('⚠️ Schedule differences detected:', comparison);
          }
        }
      } else {
        throw new Error('Invalid response format from API');
      }
    } catch (error) {
      console.error('API Test Error:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      
      let errorMessage = error.message || 'Failed to calculate schedule from API';
      
      // Provide more specific error messages
      if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
        errorMessage = `Failed to connect to API. This is usually a CORS or network issue.
        
Please check:
1. ✅ Plugin is installed and activated (test endpoint works)
2. 🔍 Check browser console (F12) → Network tab for detailed error
3. 🔍 Look for CORS errors in console
4. 🔍 Verify you're logged in (authentication required)

API endpoint: ${apiBase}/echovault/v2/calculate-schedule`;
      }
      
      setApiTestError(errorMessage);
      setApiTestSuccess(false);
      setApiSchedule([]);
    } finally {
      setApiTestLoading(false);
    }
  };

  // Helper to compare client-side and API schedules
  const compareSchedules = (clientSchedule, apiSchedule) => {
    if (clientSchedule.length !== apiSchedule.length) {
      return { match: false, message: `Different lengths: Client ${clientSchedule.length} vs API ${apiSchedule.length}` };
    }

    const differences = [];
    for (let i = 0; i < clientSchedule.length; i++) {
      const client = clientSchedule[i];
      const api = apiSchedule[i];
      
      const paymentDiff = Math.abs(client.payment - api.payment);
      const principalDiff = Math.abs(client.principal - api.principal);
      const interestDiff = Math.abs(client.interest - api.interest);
      const balanceDiff = Math.abs(client.balance - api.balance);
      
      const tolerance = 0.01; // Allow 1 cent difference due to rounding
      
      if (paymentDiff > tolerance || principalDiff > tolerance || interestDiff > tolerance || balanceDiff > tolerance) {
        differences.push({
          row: i + 1,
          payment: { client: client.payment, api: api.payment, diff: paymentDiff },
          principal: { client: client.principal, api: api.principal, diff: principalDiff },
          interest: { client: client.interest, api: api.interest, diff: interestDiff },
          balance: { client: client.balance, api: api.balance, diff: balanceDiff }
        });
      }
    }

    return {
      match: differences.length === 0,
      differences: differences,
      message: differences.length === 0 
        ? 'Schedules match perfectly!' 
        : `Found ${differences.length} row(s) with differences`
    };
  };

  const getDisbursementLabel = () => {
    try {
      const disb = form.loan_disbursement_account ? JSON.parse(form.loan_disbursement_account) : null;
      if (!disb) return '';
      const bank = Array.isArray(disb.bankName) ? (disb.bankName[0] || '') : (disb.bankName || '');
      const parts = [disb.accountName || '', bank, disb.accountNumber || '', disb.bsb ? `BSB ${disb.bsb}` : ''].filter(Boolean);
      return parts.join(' • ');
    } catch (_) {
      return '';
    }
  };

  const getRepaymentLabel = () => {
    const acc = activeSystemAccounts.find(a => String(a.id) === String(form.loan_repayment_account));
    if (!acc) return '';
    const country = Array.isArray(acc.account_type) ? acc.account_type[0] : acc.account_type;
    const bank = country === 'Australia' ? (Array.isArray(acc.bank_name_au) ? acc.bank_name_au[0] : acc.bank_name_au) : (Array.isArray(acc.bank_name_mn) ? acc.bank_name_mn[0] : acc.bank_name_mn);
    const parts = [acc.account_name || '', bank || '', acc.account_number || '', acc.bsb ? `BSB ${acc.bsb}` : ''].filter(Boolean);
    return parts.join(' • ');
  };

  // Upload helpers for media to WordPress and return attachment IDs
  const uploadMediaFile = async (file) => {
    const fd = new FormData();
    fd.append('file', file, file.name);
    const resp = await fetch(`${apiBase}/wp/v2/media`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: fd,
      mode: 'cors'
    });
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(t || `Failed to upload ${file.name}`);
    }
    const json = await resp.json();
    return json?.id;
  };
  const uploadBankStatementsToMedia = async () => {
    if (!bankStatements || bankStatements.length === 0) return [];
    const ids = [];
    for (const f of bankStatements) {
      // Check if it's already a media object with an ID (from editing existing draft)
      if (typeof f === 'object' && (f.ID || f.id) && !(f instanceof File) && !(f instanceof Blob)) {
        // Already uploaded media object, just use its ID
        const existingId = f.ID || f.id;
        if (existingId) ids.push(existingId);
      } else if (f instanceof File || f instanceof Blob) {
        // New file, upload it
        const id = await uploadMediaFile(f);
        if (id) ids.push(id);
      }
    }
    return ids;
  };

  // Client-side calculation (fallback)
  const calculateScheduleClientSide = () => {
    if (!form.loan_amount || !form.loan_term || !form.start_date || !selectedProduct) {
      setSchedule([]);
      return;
    }
    const principal = Number(form.loan_amount);
    const n = periodsForFrequency(form.loan_term, form.repayment_frequency);
    const r = ratePerPeriod(form.loan_interest || selectedProduct?.interest_rate || 0, form.repayment_frequency);
    if (!n || principal <= 0) {
      setSchedule([]);
      return;
    }

    const rows = [];
    let balance = principal;
    const startDate = new Date(form.start_date);

    if (form.repayment_method === 'Equal Total') {
      const payment = r === 0 ? principal / n : (principal * r) / (1 - Math.pow(1 + r, -n));
      for (let i = 0; i < n; i++) {
        const interest = balance * r;
        const principalPaid = Math.min(payment - interest, balance);
        balance = Math.max(0, balance - principalPaid);
        rows.push({ idx: i + 1, date: nextDateFrom(startDate, i, form.repayment_frequency), payment, principal: principalPaid, interest, balance });
      }
    } else if (form.repayment_method === 'Interest-Only') {
      const interestOnly = balance * r;
      for (let i = 0; i < n - 1; i++) {
        rows.push({ idx: i + 1, date: nextDateFrom(startDate, i, form.repayment_frequency), payment: interestOnly, principal: 0, interest: interestOnly, balance });
      }
      rows.push({ idx: n, date: nextDateFrom(startDate, n - 1, form.repayment_frequency), payment: interestOnly + balance, principal: balance, interest: interestOnly, balance: 0 });
    } else {
      const principalPer = principal / n;
      for (let i = 0; i < n; i++) {
        const interest = balance * r;
        const payment = principalPer + interest;
        balance = Math.max(0, balance - principalPer);
        rows.push({ idx: i + 1, date: nextDateFrom(startDate, i, form.repayment_frequency), payment, principal: principalPer, interest, balance });
      }
    }
    setSchedule(rows);
  };

  // Function to calculate schedule from backend API
  const calculateScheduleFromAPI = async () => {
    if (!form.loan_amount || !form.loan_term || !form.start_date || !selectedProduct) {
      setSchedule([]);
      return;
    }

    try {
      const endpoint = `${apiBase}/echovault/v2/calculate-schedule`;
      const requestBody = {
        loan_amount: Number(form.loan_amount),
        loan_term: Number(form.loan_term),
        loan_interest: Number(form.loan_interest || selectedProduct?.interest_rate || 0),
        repayment_method: form.repayment_method,
        repayment_frequency: form.repayment_frequency,
        start_date: form.start_date
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody),
        mode: 'cors',
        credentials: 'omit'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.schedule) {
          // Debug: Log received frequency and periods
          if (data.debug) {
            console.log('API Response Debug:', {
              frequency: data.debug.frequency,
              method: data.debug.method,
              periods: data.debug.periods,
              scheduleLength: data.schedule.length
            });
          }
          
          // Convert date strings to Date objects for compatibility
          const scheduleWithDates = data.schedule.map(row => ({
            ...row,
            date: new Date(row.date)
          }));
          setSchedule(scheduleWithDates);
          setApiTestError('');
          return;
        } else {
          console.error('API returned success=false:', data);
        }
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        console.error('API calculation failed:', response.status, errorData);
      }
      // If API fails, fall back to client-side calculation
      console.warn('API calculation failed, falling back to client-side calculation');
      calculateScheduleClientSide();
    } catch (error) {
      console.warn('API calculation error, falling back to client-side calculation:', error);
      // Fall back to client-side calculation on error
      calculateScheduleClientSide();
    }
  };

  useEffect(() => {
    // Calculate schedule from backend API when inputs change
    // Falls back to client-side calculation if API fails
    calculateScheduleFromAPI();
  }, [form.loan_amount, form.loan_term, form.repayment_frequency, form.repayment_method, form.start_date, form.loan_interest, selectedProduct, token]);

  const validate = () => {
    if (!form.borrower) return 'Borrower is required';
    if (form.co_borrower_status === 'Yes' && !form.co_borrower) return 'Co-borrower is required';
    if (!form.loan_product) return 'Loan product is required';
    if (!form.loan_term) return 'Loan term is required';
    if (!form.loan_amount) return 'Loan amount is required';
    if (minTerm && Number(form.loan_term) < Number(minTerm)) return `Loan term must be ≥ ${minTerm}`;
    if (maxTerm && Number(form.loan_term) > Number(maxTerm)) return `Loan term must be ≤ ${maxTerm}`;
    if (minAmount && Number(form.loan_amount) < Number(minAmount)) return `Amount must be ≥ ${minAmount}`;
    if (maxAmount && Number(form.loan_amount) > Number(maxAmount)) return `Amount must be ≤ ${maxAmount}`;
    if (!form.start_date) return 'Start date is required';
    if (!form.end_date) return 'End date is required';
    if (!form.loan_repayment_account) return 'Repayment account is required';
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) return;
    const msg = validate();
    if (msg) { setError(msg); return; }
    setError('');
    setSubmitting(true);
    try {
      const fd = new FormData();
      // Upload bank statements to media first to get attachment IDs
      let bankIds = [];
      try {
        bankIds = await uploadBankStatementsToMedia();
      } catch (e) {
        // Non-fatal: still allow creating loan even if uploads failed
        console.error('Bank statement upload failed:', e);
      }
      
      // Upload collateral to media if present
      let collateralId = null;
      try {
        if (collateralFile) {
          // Check if it's already a media object with an ID
          if (typeof collateralFile === 'object' && (collateralFile.ID || collateralFile.id) && !(collateralFile instanceof File) && !(collateralFile instanceof Blob)) {
            collateralId = collateralFile.ID || collateralFile.id;
          } else if (collateralFile instanceof File || collateralFile instanceof Blob) {
            collateralId = await uploadMediaFile(collateralFile);
          }
        }
      } catch (e) {
        console.error('Collateral upload failed:', e);
      }
      
      // Upload loan contract to media if present
      let contractId = null;
      try {
        if (loanContractFile) {
          // Check if it's already a media object with an ID
          if (typeof loanContractFile === 'object' && (loanContractFile.ID || loanContractFile.id) && !(loanContractFile instanceof File) && !(loanContractFile instanceof Blob)) {
            contractId = loanContractFile.ID || loanContractFile.id;
          } else if (loanContractFile instanceof File || loanContractFile instanceof Blob) {
            contractId = await uploadMediaFile(loanContractFile);
          }
        }
      } catch (e) {
        console.error('Loan contract upload failed:', e);
      }

      // Build disbursement snapshot (from JSON value)
      let disbLabel = '';
      let disbName = '';
      let disbBank = '';
      let disbBSB = '';
      let disbNumber = '';
      try {
        const disb = form.loan_disbursement_account ? JSON.parse(form.loan_disbursement_account) : null;
        if (disb) {
          disbName = disb.accountName || '';
          disbBank = Array.isArray(disb.bankName) ? (disb.bankName[0] || '') : (disb.bankName || '');
          disbBSB = disb.bsb || '';
          disbNumber = disb.accountNumber || '';
          disbLabel = [disbName, disbBank, disbNumber, disbBSB && `BSB ${disbBSB}`].filter(Boolean).join(' • ');
        }
      } catch (_) {}

      // Build repayment snapshot (resolve by ID)
      let repayName = '';
      let repayBank = '';
      let repayBSB = '';
      let repayNumber = '';
      const repayAcc = systemAccounts.find(a => String(a.id) === String(form.loan_repayment_account));
      if (repayAcc) {
        const country = Array.isArray(repayAcc.account_type) ? repayAcc.account_type[0] : repayAcc.account_type;
        repayBank = country === 'Australia'
          ? (Array.isArray(repayAcc.bank_name_au) ? repayAcc.bank_name_au[0] : repayAcc.bank_name_au)
          : (Array.isArray(repayAcc.bank_name_mn) ? repayAcc.bank_name_mn[0] : repayAcc.bank_name_mn);
        repayName = repayAcc.account_name || '';
        repayBSB = repayAcc.bsb || '';
        repayNumber = repayAcc.account_number || '';
      }

      // Borrower snapshot
      const borrowerSnap = borrowers.find(b => String(b.id) === String(form.borrower));
      const borrowerFirst = borrowerSnap ? (borrowerSnap.first_name || '') : '';
      const borrowerLast = borrowerSnap ? (borrowerSnap.last_name || '') : '';
      const borrowerEmail = borrowerSnap ? (borrowerSnap.email_address || '') : '';
      const borrowerPhone = borrowerSnap ? (borrowerSnap.mobile_number || '') : '';

      // Save friendly strings (not IDs/JSON) at top-level per requirement
      const data = {
        title: form.loan_id,
        status: 'publish',
        loan_id: form.loan_id,
        borrower: form.borrower,
        borrower_name: [borrowerFirst, borrowerLast].filter(Boolean).join(' '),
        co_borrower_status: form.co_borrower_status,
        co_borrower: form.co_borrower || '',
        loan_product: (selectedProduct && selectedProduct.product_name) ? selectedProduct.product_name : String(form.loan_product || ''),
        loan_currency: form.loan_currency,
        loan_interest: form.loan_interest,
        loan_term: form.loan_term,
        loan_amount: form.loan_amount,
        repayment_method: form.repayment_method,
        repayment_frequency: form.repayment_frequency,
        repayment_type: form.repayment_type,
        start_date: form.start_date,
        end_date: form.end_date,
        // Disbursement friendly fields
        loan_disbursement_account: disbLabel || '',
        loan_disbursement_account_name: disbName || '',
        loan_disbursement_account_bank: disbBank || '',
        loan_disbursement_account_bsb: disbBSB || '',
        loan_disbursement_account_number: disbNumber || '',
        // Repayment friendly fields
        loan_repayment_account: repayName ? `${repayName} • ${repayBank} • ${repayNumber}${repayBSB ? ` • BSB ${repayBSB}` : ''}` : String(form.loan_repayment_account || ''),
        loan_repayment_account_name: repayName || '',
        loan_repayment_account_bank: repayBank || '',
        loan_repayment_account_bsb: repayBSB || '',
        loan_repayment_account_number: repayNumber || ''
      };
      if (form.loan_note) {
        data.loan_note = form.loan_note;
      }
      data.loan_status = 'Active';
      Object.entries(data).forEach(([k, v]) => fd.append(k, v));
      // Also include as meta for backends expecting meta[...] keys
      fd.append('meta[loan_currency]', form.loan_currency);
      fd.append('meta[loan_interest]', form.loan_interest);
      fd.append('meta[loan_id]', form.loan_id);
      if (form.loan_note) {
        fd.append('meta[loan_note]', form.loan_note);
      }
      fd.append('meta[loan_status]', 'Active');
      if (selectedProduct) {
        fd.append('meta[loan_product_id]', String(selectedProduct.id));
        fd.append('meta[loan_product_name]', String(selectedProduct.product_name || ''));
      }
      if (borrowerSnap) {
        fd.append('meta[borrower_id]', String(borrowerSnap.id));
        fd.append('meta[borrower_first_name]', String(borrowerFirst));
        fd.append('meta[borrower_last_name]', String(borrowerLast));
        fd.append('meta[borrower_email]', String(borrowerEmail));
        fd.append('meta[borrower_phone]', String(borrowerPhone));
      }
      if (form.co_borrower) {
        fd.append('meta[co_borrower_id]', String(form.co_borrower));
      }
      if (disbName || disbBank || disbNumber || disbBSB) {
        fd.append('meta[disbursement_account_name]', disbName);
        fd.append('meta[disbursement_account_bank]', disbBank);
        fd.append('meta[disbursement_account_bsb]', disbBSB);
        fd.append('meta[disbursement_account_number]', disbNumber);
      }
      if (repayName || repayBank || repayNumber || repayBSB) {
        fd.append('meta[repayment_account_name]', repayName);
        fd.append('meta[repayment_account_bank]', repayBank);
        fd.append('meta[repayment_account_bsb]', repayBSB);
        fd.append('meta[repayment_account_number]', repayNumber);
      }
      if (form.loan_repayment_account) {
        fd.append('meta[repayment_account_id]', String(form.loan_repayment_account));
      }
      if (bankIds && bankIds.length > 0) {
        // Save for multiple backends: Pods/ACF/meta
        bankIds.forEach(id => fd.append('meta[bank_statement][]', String(id)));
        bankIds.forEach(id => fd.append('fields[bank_statement][]', String(id)));
        fd.append('fields[bank_statement]', JSON.stringify(bankIds.map(String)));
        fd.append('bank_statement', JSON.stringify(bankIds.map(String)));
        bankIds.forEach(id => fd.append('bank_statement[]', String(id)));
        fd.append('meta[bank_statement_count]', String(bankIds.length));
      }
      if (collateralId) {
        fd.append('meta[collateral]', String(collateralId));
        fd.append('fields[collateral]', String(collateralId));
        fd.append('collateral', String(collateralId));
      }
      if (contractId) {
        fd.append('meta[loan_contract]', String(contractId));
        fd.append('fields[loan_contract]', String(contractId));
        fd.append('loan_contract', String(contractId));
      }



      const loanId = editingLoan ? toId(editingLoan.id || editingLoan.ID) : null;
      const url = loanId ? `${apiBase}/wp/v2/loans/${loanId}` : `${apiBase}/wp/v2/loans`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: fd,
        mode: 'cors'
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt || (editingLoan ? 'Failed to update loan' : 'Failed to create loan'));
      }
      
      const createdLoan = await resp.json();
      const newLoanId = createdLoan.id || createdLoan.ID || loanId;
      
      // FORCE GENERATE SCHEDULE IMMEDIATELY after loan creation
      // Wait 2 seconds for meta to be saved first
      if (newLoanId && !editingLoan) {
        setTimeout(async () => {
          try {
            const generateResp = await fetch(`${apiBase}/echovault/v2/force-generate-schedule?loan_id=${newLoanId}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
              },
              mode: 'cors',
              credentials: 'omit'
            });
            
            const contentType = generateResp.headers.get('content-type');
            if (generateResp.ok && contentType && contentType.includes('application/json')) {
              const generateData = await generateResp.json();
              if (generateData.success) {
                console.log('Schedule generated successfully:', generateData.segments_created, 'segments');
              } else {
                console.error('Schedule generation failed:', generateData.error, generateData.debug);
              }
            } else {
              const errorText = await generateResp.text();
              console.error('Schedule generation failed:', generateResp.status, errorText.substring(0, 200));
            }
          } catch (genError) {
            console.error('Schedule generation error:', genError);
            // Don't fail loan creation if schedule generation fails
          }
        }, 2000); // Wait 2 seconds for meta to be saved
      }
      
      setSuccessMessage({ show: true, message: editingLoan ? 'Loan updated successfully!' : 'Loan created successfully!', type: 'success' });
      setTimeout(() => setCurrentView('loans-active'), 900);
    } catch (err) {
      setError(err.message || 'Failed to create loan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!token) return;
    // Require at least one of Borrower or Loan Product before saving draft
    if (!hasValue(form.borrower) && !hasValue(form.loan_product)) {
      setError('Provide at least Borrower or Loan Product to save draft');
      return;
    }
    setError('');
    setSavingDraft(true);
    try {
      // Get loan ID early for update logic
      const loanId = editingLoan ? toId(editingLoan.id || editingLoan.ID) : null;
      const fd = new FormData();
      // Upload bank statements to media to get IDs for draft as well
      let bankIds = [];
      try {
        bankIds = await uploadBankStatementsToMedia();
      } catch (e) {
        console.error('Bank statement upload failed (draft):', e);
      }
      // Upload collateral to media if present
      let collateralId = null;
      try {
        if (collateralFile) {
          // Check if it's already a media object with an ID
          if (typeof collateralFile === 'object' && (collateralFile.ID || collateralFile.id) && !(collateralFile instanceof File) && !(collateralFile instanceof Blob)) {
            collateralId = collateralFile.ID || collateralFile.id;
          } else if (collateralFile instanceof File || collateralFile instanceof Blob) {
            collateralId = await uploadMediaFile(collateralFile);
          }
        }
      } catch (e) {
        console.error('Collateral upload failed (draft):', e);
      }
      // Upload loan contract to media if present
      let contractId = null;
      try {
        if (loanContractFile) {
          // Check if it's already a media object with an ID
          if (typeof loanContractFile === 'object' && (loanContractFile.ID || loanContractFile.id) && !(loanContractFile instanceof File) && !(loanContractFile instanceof Blob)) {
            contractId = loanContractFile.ID || loanContractFile.id;
          } else if (loanContractFile instanceof File || loanContractFile instanceof Blob) {
            contractId = await uploadMediaFile(loanContractFile);
          }
        }
      } catch (e) {
        console.error('Loan contract upload failed (draft):', e);
      }
      // Disbursement snapshot
      let disbLabel = '';
      let disbName = '';
      let disbBank = '';
      let disbBSB = '';
      let disbNumber = '';
      try {
        const disb = form.loan_disbursement_account ? JSON.parse(form.loan_disbursement_account) : null;
        if (disb) {
          disbName = disb.accountName || '';
          disbBank = Array.isArray(disb.bankName) ? (disb.bankName[0] || '') : (disb.bankName || '');
          disbBSB = disb.bsb || '';
          disbNumber = disb.accountNumber || '';
          disbLabel = [disbName, disbBank, disbNumber, disbBSB && `BSB ${disbBSB}`].filter(Boolean).join(' • ');
        }
      } catch (_) {}
      // Repayment snapshot
      let repayName = '';
      let repayBank = '';
      let repayBSB = '';
      let repayNumber = '';
      const repayAcc = systemAccounts.find(a => String(a.id) === String(form.loan_repayment_account));
      if (repayAcc) {
        const country = Array.isArray(repayAcc.account_type) ? repayAcc.account_type[0] : repayAcc.account_type;
        repayBank = country === 'Australia'
          ? (Array.isArray(repayAcc.bank_name_au) ? repayAcc.bank_name_au[0] : repayAcc.bank_name_au)
          : (Array.isArray(repayAcc.bank_name_mn) ? repayAcc.bank_name_mn[0] : repayAcc.bank_name_mn);
        repayName = repayAcc.account_name || '';
        repayBSB = repayAcc.bsb || '';
        repayNumber = repayAcc.account_number || '';
      }
      // Borrower snapshot
      const borrowerSnap = borrowers.find(b => String(b.id) === String(form.borrower));
      const borrowerFirst = borrowerSnap ? (borrowerSnap.first_name || '') : '';
      const borrowerLast = borrowerSnap ? (borrowerSnap.last_name || '') : '';
      const borrowerEmail = borrowerSnap ? (borrowerSnap.email_address || '') : '';
      const borrowerPhone = borrowerSnap ? (borrowerSnap.mobile_number || '') : '';
      // Build payload (status draft)
      const data = {
        title: form.loan_id || 'Draft Loan',
        status: 'draft',
        loan_id: form.loan_id,
        borrower: form.borrower,
        borrower_name: [borrowerFirst, borrowerLast].filter(Boolean).join(' '),
        co_borrower_status: form.co_borrower_status,
        co_borrower: form.co_borrower || '',
        loan_product: (selectedProduct && selectedProduct.product_name) ? selectedProduct.product_name : String(form.loan_product || ''),
        loan_currency: form.loan_currency,
        loan_interest: form.loan_interest,
        loan_term: form.loan_term,
        loan_amount: form.loan_amount,
        repayment_method: form.repayment_method,
        repayment_frequency: form.repayment_frequency,
        repayment_type: form.repayment_type,
        start_date: form.start_date,
        end_date: form.end_date,
        loan_disbursement_account: disbLabel || '',
        loan_disbursement_account_name: disbName || '',
        loan_disbursement_account_bank: disbBank || '',
        loan_disbursement_account_bsb: disbBSB || '',
        loan_disbursement_account_number: disbNumber || '',
        loan_repayment_account: repayName ? `${repayName} • ${repayBank} • ${repayNumber}${repayBSB ? ` • BSB ${repayBSB}` : ''}` : String(form.loan_repayment_account || ''),
        loan_repayment_account_name: repayName || '',
        loan_repayment_account_bank: repayBank || '',
        loan_repayment_account_bsb: repayBSB || '',
        loan_repayment_account_number: repayNumber || ''
      };
      if (form.loan_note) {
        data.loan_note = form.loan_note;
      }
      data.loan_status = 'Draft';
      Object.entries(data).forEach(([k, v]) => fd.append(k, v));
      // Also include as meta for backends expecting meta[...] keys
      fd.append('meta[loan_currency]', form.loan_currency);
      fd.append('meta[loan_interest]', form.loan_interest);
      fd.append('meta[loan_id]', form.loan_id);
      if (form.loan_note) {
        fd.append('meta[loan_note]', form.loan_note);
      }
      fd.append('meta[loan_status]', 'Draft');
      if (selectedProduct) {
        fd.append('meta[loan_product_id]', String(selectedProduct.id));
        fd.append('meta[loan_product_name]', String(selectedProduct.product_name || ''));
      }
      if (borrowerSnap) {
        fd.append('meta[borrower_id]', String(borrowerSnap.id));
        fd.append('meta[borrower_first_name]', String(borrowerFirst));
        fd.append('meta[borrower_last_name]', String(borrowerLast));
        fd.append('meta[borrower_email]', String(borrowerEmail));
        fd.append('meta[borrower_phone]', String(borrowerPhone));
      }
      if (form.co_borrower) {
        fd.append('meta[co_borrower_id]', String(form.co_borrower));
      }
      if (disbName || disbBank || disbNumber || disbBSB) {
        fd.append('meta[disbursement_account_name]', disbName);
        fd.append('meta[disbursement_account_bank]', disbBank);
        fd.append('meta[disbursement_account_bsb]', disbBSB);
        fd.append('meta[disbursement_account_number]', disbNumber);
      }
      if (repayName || repayBank || repayNumber || repayBSB) {
        fd.append('meta[repayment_account_name]', repayName);
        fd.append('meta[repayment_account_bank]', repayBank);
        fd.append('meta[repayment_account_bsb]', repayBSB);
        fd.append('meta[repayment_account_number]', repayNumber);
      }
      if (form.loan_repayment_account) {
        fd.append('meta[repayment_account_id]', String(form.loan_repayment_account));
      }
      // Handle bank statements - always send array, even if empty (to clear when updating)
      if (loanId && bankIds.length === 0) {
        // When updating and no bank statements, explicitly clear them
        fd.append('meta[bank_statement]', '');
        fd.append('fields[bank_statement]', '[]');
        fd.append('bank_statement', '[]');
        fd.append('meta[bank_statement_count]', '0');
      } else if (bankIds && bankIds.length > 0) {
        bankIds.forEach(id => fd.append('meta[bank_statement][]', String(id)));
        bankIds.forEach(id => fd.append('fields[bank_statement][]', String(id)));
        fd.append('fields[bank_statement]', JSON.stringify(bankIds.map(String)));
        fd.append('bank_statement', JSON.stringify(bankIds.map(String)));
        bankIds.forEach(id => fd.append('bank_statement[]', String(id)));
        fd.append('meta[bank_statement_count]', String(bankIds.length));
      }
      
      // Handle collateral - always send value when updating to preserve or clear
      if (loanId && !collateralId) {
        // When updating and no collateral, explicitly clear it
        fd.append('meta[collateral]', '');
        fd.append('fields[collateral]', '');
        fd.append('collateral', '');
      } else if (collateralId) {
        fd.append('meta[collateral]', String(collateralId));
        fd.append('fields[collateral]', String(collateralId));
        fd.append('collateral', String(collateralId));
      }
      
      // Handle contract - always send value when updating to preserve or clear
      if (loanId && !contractId) {
        // When updating and no contract, explicitly clear it
        fd.append('meta[loan_contract]', '');
        fd.append('fields[loan_contract]', '');
        fd.append('loan_contract', '');
      } else if (contractId) {
        fd.append('meta[loan_contract]', String(contractId));
        fd.append('fields[loan_contract]', String(contractId));
        fd.append('loan_contract', String(contractId));
      }
      const url = loanId ? `${apiBase}/wp/v2/loans/${loanId}` : `${apiBase}/wp/v2/loans`;
      const resp = await fetch(url, {
        method: loanId ? 'POST' : 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: fd,
        mode: 'cors'
      });
      if (!resp.ok) {
        const txt = await resp.text();
        console.error('Save draft error:', txt);
        throw new Error(txt || 'Failed to save draft');
      }
      const responseData = await resp.json();
      const savedLoanId = responseData.id || responseData.ID || loanId;
      
      // Schedule is automatically generated on backend when loan is saved
      // No need to call API - backend hooks handle it
      
      setSuccessMessage({ show: true, message: editingLoan ? 'Draft updated.' : 'Draft saved.', type: 'success' });
    } catch (err) {
      setError(err.message || 'Failed to save draft');
    } finally {
      setSavingDraft(false);
    }
  };

  const Stepper = () => {
    const steps = ['Loan Form','Borrowers','Schedule','Bank Statements','Collateral','Contract','Note','Confirm'];
    const pct = ((step - 1) / (steps.length - 1)) * 100;
    return (
      <div className="mb-6">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-in-out" style={{ width: `${pct}%` }}></div>
        </div>
        <div className="flex justify-between items-center mt-3">
          {steps.map((label, i) => (
            <div key={label} className="flex flex-col items-center w-full">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${step-1 >= i ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'} transition-colors duration-300`}>{i+1}</div>
              <div className={`mt-1 text-[11px] ${step-1 === i ? 'font-semibold text-blue-700' : 'text-gray-700'}`}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const BorrowerBadge = ({ b }) => {
    if (!b) return null;
    return (
      <div className="p-4 border rounded-lg bg-gray-50">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-900">{b.first_name} {b.last_name}</div>
            <div className="text-xs text-gray-600">{b.email_address}</div>
            {b.mobile_number && <div className="text-xs text-gray-600">{b.mobile_number}</div>}
          </div>
          <button
            type="button"
            onClick={() => onOpenBorrower && onOpenBorrower(b.id)}
            className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded"
            title="Open borrower profile"
          >
            View Profile
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3 text-xs text-gray-700">
          {b.date_of_birth && <div><span className="text-gray-500">DOB:</span> {b.date_of_birth}</div>}
          {b.home_address && <div><span className="text-gray-500">Address:</span> {b.home_address}</div>}
          {b.employment_status && <div><span className="text-gray-500">Employment:</span> {b.employment_status}</div>}
          {b.monthly_income_aud && <div><span className="text-gray-500">Monthly Income:</span> {b.monthly_income_aud}</div>}
          {b.bank_name && <div><span className="text-gray-500">Bank:</span> {b.bank_name}</div>}
          {b.account_number && <div><span className="text-gray-500">Account:</span> {b.account_number}</div>}
        </div>
      </div>
    );
  };

  const NavButtons = ({ onNext, onPrev, nextLabel = 'Next' }) => (
    <div className="md:col-span-2 flex justify-between space-x-4 pt-6 border-t border-gray-200 mt-2">
      <div>
        {step > 1 && (
          <button type="button" onClick={onPrev} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium">Back</button>
        )}
      </div>
      <div>
        {step < 5 && (
          <button type="button" onClick={onNext} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">{nextLabel}</button>
        )}
        {step === 5 && (
          <button type="submit" disabled={submitting} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2">
            {submitting && (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            <span>{submitting ? 'Creating...' : 'Confirm & Create Loan'}</span>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div>
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Create New Loan</h1>
            <p className="text-gray-600">Start a new loan for a borrower</p>
          </div>
        </div>
      </div>

      <Stepper />

      {error && <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>}

      {loading ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="animate-spin h-12 w-12 text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Loading data...</h3>
          <p className="text-gray-500">Please wait while we fetch borrowers, products, and accounts.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {step === 1 && (<>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Loan ID</label>
              <input type="text" value={form.loan_id} disabled className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Borrower</label>
              <select name="borrower" value={form.borrower} onChange={onChange} className={`w-full px-3 py-2 border rounded-md ${isMissing.borrower && step===1 ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}`} required>
                <option value="">Select verified borrower</option>
                {verifiedBorrowers.map(b => (
                  <option key={b.id} value={b.id}>{b.first_name} {b.last_name} ({b.email_address})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Co-borrower Status</label>
              <select name="co_borrower_status" value={form.co_borrower_status} onChange={onChange} className="w-full px-3 py-2 border border-gray-300 rounded-md">
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>

            {form.co_borrower_status === 'Yes' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Co-borrower</label>
                <select name="co_borrower" value={form.co_borrower} onChange={onChange} className={`w-full px-3 py-2 border rounded-md ${isMissing.co_borrower && step===1 ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}`}>
                  <option value="">Select borrower</option>
                  {coBorrowerOptions.map(b => (
                    <option key={b.id} value={b.id}>{b.first_name} {b.last_name} ({b.email_address})</option>
                  ))}
                </select>
              </div>
            )}

            {/* Collateral moved to step 4 */}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Loan Product</label>
              <select name="loan_product" value={form.loan_product} onChange={onChange} className={`w-full px-3 py-2 border rounded-md ${isMissing.loan_product && step===1 ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}`} required>
                <option value="">Select active product</option>
                {activeProducts.map(p => (
                  <option key={p.id} value={p.id}>{p.product_name} (Term {p.term_min}-{p.term_max}m, {p.currency})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <input type="text" value={form.loan_currency} disabled className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Interest (%)</label>
              <input type="number" step="0.01" value={form.loan_interest} disabled className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Loan Term (months)</label>
              <input name="loan_term" type="number" min={minTerm || 1} max={maxTerm || undefined} value={form.loan_term} onChange={onNumber} className={`w-full px-3 py-2 border rounded-md ${isMissing.loan_term && step===1 ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}`} required />
              {(minTerm || maxTerm) && (
                <p className={`text-xs mt-1 ${termOutOfRange && step===1 ? 'text-red-600' : 'text-gray-500'}`}>Allowed: {minTerm || '?'} - {maxTerm || '?'} months</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Loan Amount</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">{getCurrencySymbol(form.loan_currency || selectedProduct?.currency)}</span>
                <input name="loan_amount" type="number" min={minAmount || 0} max={maxAmount || undefined} value={form.loan_amount} onChange={onNumber} className={`w-full pl-8 pr-3 py-2 border rounded-md ${isMissing.loan_amount && step===1 ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}`} required />
              </div>
              {(minAmount || maxAmount) && (
                <p className={`text-xs mt-1 ${amountOutOfRange && step===1 ? 'text-red-600' : 'text-gray-500'}`}>
                  Range: {getCurrencySymbol(form.loan_currency || selectedProduct?.currency)}{minAmount || 0} - {getCurrencySymbol(form.loan_currency || selectedProduct?.currency)}{maxAmount || '∞'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Repayment Method</label>
              <select name="repayment_method" value={form.repayment_method} onChange={onChange} className="w-full px-3 py-2 border border-gray-300 rounded-md">
                <option>Equal Principal</option>
                <option>Equal Total</option>
                <option>Interest-Only</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Repayment Frequency</label>
              <select name="repayment_frequency" value={form.repayment_frequency} onChange={onChange} className="w-full px-3 py-2 border border-gray-300 rounded-md">
                <option>Weekly</option>
                <option>Fortnightly</option>
                <option>Monthly</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Repayment Type</label>
              <select name="repayment_type" value={form.repayment_type} onChange={onChange} className="w-full px-3 py-2 border border-gray-300 rounded-md">
                <option>Graphical</option>
                <option>Non Graphical</option>
              </select>
            </div>

            {/* Loan status is set automatically based on action (draft vs confirm) */}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input name="start_date" type="date" value={form.start_date} onChange={onChange} className={`w-full px-3 py-2 border rounded-md ${isMissing.start_date && step===1 ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}`} required />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input name="end_date" type="date" value={form.end_date} onChange={onChange} className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50" disabled />
              <p className="text-xs text-gray-500 mt-1">Auto-calculated from start date and loan term</p>
            </div>

            {/* Contract upload moved to step 5 */}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Disbursement Account (Borrower)</label>
              <select name="loan_disbursement_account" value={form.loan_disbursement_account} onChange={onChange} className={`w-full px-3 py-2 border rounded-md ${isMissing.loan_disbursement_account && step===1 ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}`} disabled={!borrowerDisbursementOptions.length}>
                <option value="">{borrowerDisbursementOptions.length ? 'Select borrower account' : 'No borrower account found'}</option>
                {borrowerDisbursementOptions.map((opt, idx) => (
                  <option key={idx} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Repayment Account (System)</label>
              <select name="loan_repayment_account" value={form.loan_repayment_account} onChange={onChange} className={`w-full px-3 py-2 border rounded-md ${isMissing.loan_repayment_account && step===1 ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}`} required>
                <option value="">Select active system account</option>
                {activeSystemAccounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {(Array.isArray(a.account_type) ? a.account_type[0] : a.account_type) === 'Australia' ? (Array.isArray(a.bank_name_au) ? a.bank_name_au[0] : a.bank_name_au) : (Array.isArray(a.bank_name_mn) ? a.bank_name_mn[0] : a.bank_name_mn)} • {a.account_name} • {a.account_number}{a.bsb ? ` • BSB ${a.bsb}` : ''}
                  </option>
                ))}
              </select>
            </div>
              <div className="md:col-span-2 flex justify-between space-x-4 pt-6 border-t border-gray-200 mt-2">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => attemptExit(() => setCurrentView('loans-active'))} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium">Cancel</button>
                <button type="button" onClick={handleSaveDraft} disabled={savingDraft || (!hasValue(form.borrower) && !hasValue(form.loan_product))} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed">{savingDraft ? 'Saving…' : (<span className="inline-flex items-center"><svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V7l-4-4z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 3v8h10V3"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 13h10v8H7z"/></svg>Save as Draft</span>)}</button>
              </div>
              <button type="button" disabled={missingStep1().length>0} onClick={() => setStep(2)} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed">Next: Borrower Details</button>
            </div>
            </>)}

            {step === 2 && (<>
              <div className="md:col-span-2">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Borrower Details</h3>
                <BorrowerBadge b={borrowerObj} />
              </div>
              {form.co_borrower_status === 'Yes' && (
                <div className="md:col-span-2">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Co-borrower Details</h3>
                  <BorrowerBadge b={borrowers.find(b => String(b.id) === String(form.co_borrower))} />
                </div>
              )}
              <div className="md:col-span-2 flex justify-between space-x-4 pt-6 border-t border-gray-200 mt-2">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setStep(1)} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium">Back</button>
                  <button type="button" onClick={handleSaveDraft} disabled={savingDraft || (!hasValue(form.borrower) && !hasValue(form.loan_product))} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed">{savingDraft ? 'Saving…' : (<span className="inline-flex items-center"><svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V7l-4-4z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 3v8h10V3"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 13h10v8H7z"/></svg>Save as Draft</span>)}</button>
                </div>
                <button type="button" disabled={missingStep2().length>0} onClick={() => setStep(3)} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed">Next: Loan Schedule</button>
              </div>
            </>)}

            {step === 3 && (<>
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">Repayment Schedule</h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={testApiSchedule}
                      disabled={apiTestLoading || !form.loan_amount || !form.loan_term || !form.start_date}
                      className="px-3 py-1.5 text-sm rounded border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Test API calculation"
                    >
                      {apiTestLoading ? 'Testing...' : '🧪 Test API'}
                    </button>
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
                
                {/* API Test Status Messages */}
                {apiTestError && (
                  <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                    <strong>API Test Error:</strong> {apiTestError}
                  </div>
                )}
                {apiTestSuccess && (
                  <div className="mb-3 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
                    <strong>✅ API Test Successful!</strong> Schedule calculated from backend API. 
                    {apiSchedule.length > 0 && (
                      <span className="ml-2">({apiSchedule.length} payments)</span>
                    )}
                  </div>
                )}
                
                {/* Show schedule - prefer API schedule if available, otherwise show client-side */}
                {apiSchedule.length > 0 ? (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-gray-700">📡 Repayment Schedule (Calculated from Backend API)</h4>
                      <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded">
                        Scheduled by {form.repayment_frequency}
                      </span>
                    </div>
                    <div className="overflow-x-auto border rounded-md border-green-300 bg-green-50">
                      <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-green-100">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">#</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Date</th>
                            <th className="px-3 py-2 text-right font-medium text-gray-700">Payment</th>
                            <th className="px-3 py-2 text-right font-medium text-gray-700">Principal</th>
                            <th className="px-3 py-2 text-right font-medium text-gray-700">Interest</th>
                            <th className="px-3 py-2 text-right font-medium text-gray-700">Balance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {apiSchedule.map((row) => (
                            <tr key={row.idx} className="hover:bg-green-50">
                              <td className="px-3 py-1">{row.idx}</td>
                              <td className="px-3 py-1">{new Date(row.date).toLocaleDateString()}</td>
                              <td className="px-3 py-1 text-right">{getCurrencySymbol(form.loan_currency || selectedProduct?.currency)}{row.payment.toFixed(2)}</td>
                              <td className="px-3 py-1 text-right">{getCurrencySymbol(form.loan_currency || selectedProduct?.currency)}{row.principal.toFixed(2)}</td>
                              <td className="px-3 py-1 text-right">{getCurrencySymbol(form.loan_currency || selectedProduct?.currency)}{row.interest.toFixed(2)}</td>
                              <td className="px-3 py-1 text-right">{getCurrencySymbol(form.loan_currency || selectedProduct?.currency)}{row.balance.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : schedule.length > 0 ? (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-gray-700">💻 Repayment Schedule (Client-Side Calculation)</h4>
                      <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded">
                        Scheduled by {form.repayment_frequency}
                      </span>
                    </div>
                    <div className="overflow-x-auto border rounded-md">
                      <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">#</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Date</th>
                            <th className="px-3 py-2 text-right font-medium text-gray-700">Payment</th>
                            <th className="px-3 py-2 text-right font-medium text-gray-700">Principal</th>
                            <th className="px-3 py-2 text-right font-medium text-gray-700">Interest</th>
                            <th className="px-3 py-2 text-right font-medium text-gray-700">Balance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {schedule.map((row) => (
                            <tr key={row.idx} className="hover:bg-gray-50">
                              <td className="px-3 py-1">{row.idx}</td>
                              <td className="px-3 py-1">{new Date(row.date).toLocaleDateString()}</td>
                              <td className="px-3 py-1 text-right">{getCurrencySymbol(form.loan_currency || selectedProduct?.currency)}{row.payment.toFixed(2)}</td>
                              <td className="px-3 py-1 text-right">{getCurrencySymbol(form.loan_currency || selectedProduct?.currency)}{row.principal.toFixed(2)}</td>
                              <td className="px-3 py-1 text-right">{getCurrencySymbol(form.loan_currency || selectedProduct?.currency)}{row.interest.toFixed(2)}</td>
                              <td className="px-3 py-1 text-right">{getCurrencySymbol(form.loan_currency || selectedProduct?.currency)}{row.balance.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-600 p-4 bg-gray-50 rounded-md border border-gray-200">
                    Adjust loan parameters (amount, term, start date) to generate the repayment schedule.
                  </div>
                )}
              </div>
              <div className="md:col-span-2 flex justify-between space-x-4 pt-6 border-t border-gray-200 mt-2">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setStep(2)} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium">Back</button>
                  <button type="button" onClick={handleSaveDraft} disabled={savingDraft || (!hasValue(form.borrower) && !hasValue(form.loan_product))} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed">{savingDraft ? 'Saving…' : (<span className="inline-flex items-center"><svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V7l-4-4z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 3v8h10V3"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 13h10v8H7z"/></svg>Save as Draft</span>)}</button>
                </div>
                <button type="button" disabled={missingStep3().length>0} onClick={() => setStep(4)} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed">Next: Bank Statements</button>
              </div>
            </>)}

            {step === 4 && (<>
              <div className="md:col-span-2">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Bank Statements</h3>
                <div className="border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-md p-4 bg-gray-50">
                  <label className="w-full flex flex-col items-center cursor-pointer">
                    <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M12 12v9m0-9l3 3m-3-3l-3 3M12 3v9" />
                    </svg>
                    <span className="text-xs text-gray-600 mt-1">Click to upload PDF (max 5MB each)</span>
                    <input
                      type="file"
                      accept="application/pdf"
                      multiple
                      onChange={(e)=>{
                        setBankStatementsError('');
                        const files = Array.from(e.target.files || []);
                        const rejected = files.filter(f => f.type !== 'application/pdf' || f.size > 5 * 1024 * 1024);
                        if (rejected.length) {
                          setBankStatementsError('Only PDF files up to 5MB are allowed.');
                        }
                        const accepted = files.filter(f => f.type === 'application/pdf' && f.size <= 5 * 1024 * 1024);
                        setBankStatements(prev => [...prev, ...accepted]);
                      }}
                      className="hidden"
                    />
                  </label>
                  {bankStatementsError && (
                    <div className="mt-2 text-xs text-red-600">{bankStatementsError}</div>
                  )}
                  {bankStatements && bankStatements.length > 0 && (
                    <div className="mt-3">
                      <div className="text-sm font-medium text-gray-900 mb-2">Uploaded Files</div>
                      <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
                        {bankStatements.map((f, idx) => {
                          const isFileObject = f instanceof File || f instanceof Blob;
                          const sizeMb = isFileObject ? (f.size / (1024*1024)).toFixed(2) : '0.00';
                          const fileName = isFileObject ? f.name : (f.title?.rendered || f.post_title || 'Bank Statement');
                          return (
                            <li key={idx} className="flex items-center justify-between px-3 py-2 text-sm">
                              <div className="flex items-center gap-3 min-w-0">
                                <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/>
                                </svg>
                                <div className="min-w-0">
                                  <div className="truncate text-gray-900">{fileName}</div>
                                  <div className="text-xs text-gray-500">{sizeMb} MB</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button type="button" onClick={() => {
                                  if (isFileObject) {
                                    const url = URL.createObjectURL(f);
                                    window.open(url, '_blank', 'noopener');
                                    setTimeout(() => URL.revokeObjectURL(url), 10000);
                                  } else {
                                    // Media object - try different URL fields
                                    const url = f.source_url || f.guid?.rendered || f.guid?.raw || (typeof f.guid === 'string' ? f.guid : null);
                                    if (url) {
                                      window.open(url, '_blank', 'noopener');
                                    } else {
                                      console.error('No URL found for media:', f);
                                    }
                                  }
                                }} className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50">View</button>
                                <button type="button" onClick={() => setBankStatements(prev => prev.filter((_,i)=> i!==idx))} className="px-2 py-1 text-xs border border-red-200 text-red-700 rounded hover:bg-red-50">Remove</button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
              <div className="md:col-span-2 flex justify-between space-x-4 pt-6 border-t border-gray-200 mt-2">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setStep(3)} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium">Back</button>
                  <button type="button" onClick={handleSaveDraft} disabled={savingDraft || (!hasValue(form.borrower) && !hasValue(form.loan_product))} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed">{savingDraft ? 'Saving…' : (<span className="inline-flex items-center"><svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V7l-4-4z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 3v8h10V3"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 13h10v8H7z"/></svg>Save as Draft</span>)}</button>
                </div>
                <button type="button" onClick={() => setStep(5)} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">Next: Collateral</button>
              </div>
            </>)}

            {step === 5 && (<>
              <div className="md:col-span-2">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Collateral</h3>
                <div className="border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-md p-4 bg-gray-50">
                  <label className="w-full flex flex-col items-center cursor-pointer">
                    <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M12 12v9m0-9l3 3m-3-3l-3 3M12 3v9" />
                    </svg>
                    <span className="text-xs text-gray-600 mt-1">Click to upload PDF (max 5MB)</span>
                    <input type="file" accept="application/pdf" onChange={(e)=>setCollateralFile(e.target.files?.[0]||null)} className="hidden" />
                  </label>
                  {collateralFile && (
                    <div className="mt-3">
                      <div className="text-sm font-medium text-gray-900 mb-2">Uploaded File</div>
                      <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
                        <li className="flex items-center justify-between px-3 py-2 text-sm">
                          <div className="flex items-center gap-3 min-w-0">
                            <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/>
                            </svg>
                            <div className="min-w-0">
                              <div className="truncate text-gray-900">
                                {collateralFile instanceof File || collateralFile instanceof Blob 
                                  ? collateralFile.name 
                                  : (collateralFile.title?.rendered || collateralFile.filename || collateralFile.post_title || `File #${collateralFile.id || collateralFile.ID}`)}
                              </div>
                              <div className="text-xs text-gray-500">
                                {collateralFile instanceof File || collateralFile instanceof Blob
                                  ? `${(collateralFile.size / (1024*1024)).toFixed(2)} MB`
                                  : (collateralFile.mime_type || collateralFile.post_mime_type || 'PDF')}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => {
                              if (collateralFile instanceof File || collateralFile instanceof Blob) {
                                const url = URL.createObjectURL(collateralFile);
                                window.open(url, '_blank', 'noopener');
                                setTimeout(() => URL.revokeObjectURL(url), 10000);
                              } else {
                                const url = collateralFile.source_url || collateralFile.guid?.rendered || collateralFile.guid?.raw || (typeof collateralFile.guid === 'string' ? collateralFile.guid : null);
                                if (url) {
                                  window.open(url, '_blank', 'noopener');
                                } else {
                                  console.error('No URL found for collateral media:', collateralFile);
                                }
                              }
                            }} className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50">View</button>
                            <button type="button" onClick={() => setCollateralFile(null)} className="px-2 py-1 text-xs border border-red-200 text-red-700 rounded hover:bg-red-50">Remove</button>
                          </div>
                        </li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>
              <div className="md:col-span-2 flex justify-between space-x-4 pt-6 border-t border-gray-200 mt-2">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setStep(4)} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium">Back</button>
                  <button type="button" onClick={handleSaveDraft} disabled={savingDraft || (!hasValue(form.borrower) && !hasValue(form.loan_product))} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed">{savingDraft ? 'Saving…' : (<span className="inline-flex items-center"><svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V7l-4-4z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 3v8h10V3"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 13h10v8H7z"/></svg>Save as Draft</span>)}</button>
                </div>
                <button type="button" onClick={() => setStep(6)} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">Next: Contract</button>
              </div>
            </>)}

            {step === 6 && (<>
              <div className="md:col-span-2">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Contract</h3>
                <div className="border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-md p-4 bg-gray-50">
                  <label className="w-full flex flex-col items-center cursor-pointer">
                    <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M12 12v9m0-9l3 3m-3-3l-3 3M12 3v9" />
                    </svg>
                    <span className="text-xs text-gray-600 mt-1">Click to upload PDF (max 5MB)</span>
                    <input type="file" accept="application/pdf" onChange={(e)=>setLoanContractFile(e.target.files?.[0]||null)} className="hidden" />
                  </label>
                  {loanContractFile && (
                    <div className="mt-3">
                      <div className="text-sm font-medium text-gray-900 mb-2">Uploaded File</div>
                      <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
                        <li className="flex items-center justify-between px-3 py-2 text-sm">
                          <div className="flex items-center gap-3 min-w-0">
                            <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/>
                            </svg>
                            <div className="min-w-0">
                              <div className="truncate text-gray-900">
                                {loanContractFile instanceof File || loanContractFile instanceof Blob 
                                  ? loanContractFile.name 
                                  : (loanContractFile.title?.rendered || loanContractFile.filename || loanContractFile.post_title || `File #${loanContractFile.id || loanContractFile.ID}`)}
                              </div>
                              <div className="text-xs text-gray-500">
                                {loanContractFile instanceof File || loanContractFile instanceof Blob
                                  ? `${(loanContractFile.size / (1024*1024)).toFixed(2)} MB`
                                  : (loanContractFile.mime_type || loanContractFile.post_mime_type || 'PDF')}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => {
                              if (loanContractFile instanceof File || loanContractFile instanceof Blob) {
                                const url = URL.createObjectURL(loanContractFile);
                                window.open(url, '_blank', 'noopener');
                                setTimeout(() => URL.revokeObjectURL(url), 10000);
                              } else {
                                const url = loanContractFile.source_url || loanContractFile.guid?.rendered || loanContractFile.guid?.raw || (typeof loanContractFile.guid === 'string' ? loanContractFile.guid : null);
                                if (url) {
                                  window.open(url, '_blank', 'noopener');
                                } else {
                                  console.error('No URL found for contract media:', loanContractFile);
                                }
                              }
                            }} className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50">View</button>
                            <button type="button" onClick={() => setLoanContractFile(null)} className="px-2 py-1 text-xs border border-red-200 text-red-700 rounded hover:bg-red-50">Remove</button>
                          </div>
                        </li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>
              <div className="md:col-span-2 flex justify-between space-x-4 pt-6 border-t border-gray-200 mt-2">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setStep(5)} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium">Back</button>
                  <button type="button" onClick={handleSaveDraft} disabled={savingDraft || (!hasValue(form.borrower) && !hasValue(form.loan_product))} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed">{savingDraft ? 'Saving…' : (<span className="inline-flex items-center"><svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V7l-4-4z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 3v8h10V3"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 13h10v8H7z"/></svg>Save as Draft</span>)}</button>
                </div>
                <button type="button" onClick={() => setStep(7)} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">Next: Note</button>
              </div>
            </>)}

            {step === 7 && (<>
              <div className="md:col-span-2">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Note</h3>
                <textarea
                  name="loan_note"
                  value={form.loan_note}
                  onChange={onChange}
                  rows={5}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Enter any notes about this loan"
                />
              </div>
              <div className="md:col-span-2 flex justify-between space-x-4 pt-6 border-t border-gray-200 mt-2">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setStep(6)} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium">Back</button>
                  <button type="button" onClick={handleSaveDraft} disabled={savingDraft || (!hasValue(form.borrower) && !hasValue(form.loan_product))} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed">{savingDraft ? 'Saving…' : (<span className="inline-flex items-center"><svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V7l-4-4z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 3v8h10V3"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 13h10v8H7z"/></svg>Save as Draft</span>)}</button>
                </div>
                <button type="button" onClick={() => setStep(8)} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">Next: Confirm</button>
              </div>
            </>)}

            {step === 8 && (<>
              <div className="md:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Confirm Loan</h3>
                  <span className="px-2 py-1 text-xs rounded bg-blue-50 text-blue-700 border border-blue-200">Step 8 of 8</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="p-4 border rounded-lg bg-gray-50">
                    <div className="font-semibold text-gray-900 mb-2">Loan Summary</div>
                    <div className="grid grid-cols-2 gap-y-1">
                      <div className="text-gray-500">Loan ID</div><div className="text-gray-900 font-medium">{form.loan_id}</div>
                      <div className="text-gray-500">Status</div><div className="text-gray-900 font-medium">{form.loan_status}</div>
                      <div className="text-gray-500">Product</div><div className="text-gray-900 font-medium">{selectedProduct?.product_name}</div>
                      <div className="text-gray-500">Interest</div><div className="text-gray-900 font-medium">{form.loan_interest}%</div>
                      <div className="text-gray-500">Term</div><div className="text-gray-900 font-medium">{form.loan_term} months</div>
                      <div className="text-gray-500">Amount</div><div className="text-gray-900 font-medium">{getCurrencySymbol(form.loan_currency || selectedProduct?.currency)}{form.loan_amount}</div>
                      <div className="text-gray-500">Method</div><div className="text-gray-900 font-medium">{form.repayment_method}</div>
                      <div className="text-gray-500">Frequency</div><div className="text-gray-900 font-medium">{form.repayment_frequency}</div>
                      <div className="text-gray-500">Start</div><div className="text-gray-900 font-medium">{form.start_date}</div>
                      <div className="text-gray-500">End</div><div className="text-gray-900 font-medium">{form.end_date}</div>
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg bg-gray-50">
                    <div className="font-semibold text-gray-900 mb-2">Borrower</div>
                    <BorrowerBadge b={borrowerObj} />
                    {form.co_borrower_status === 'Yes' && form.co_borrower && (
                      <div className="mt-4">
                        <div className="font-semibold text-gray-900 mb-2">Co-borrower</div>
                        <BorrowerBadge b={borrowers.find(b => String(b.id) === String(form.co_borrower))} />
                      </div>
                    )}
                  </div>
                  <div className="p-4 border rounded-lg bg-gray-50">
                    <div className="font-semibold text-gray-900 mb-2">Accounts</div>
                    <div className="grid grid-cols-1 gap-y-1">
                      <div>
                        <div className="text-gray-500">Disbursement</div>
                        <div className="text-gray-900 font-medium break-all">{getDisbursementLabel() || '-'}</div>
                      </div>
                      <div className="mt-2">
                        <div className="text-gray-500">Repayment</div>
                        <div className="text-gray-900 font-medium break-all">{getRepaymentLabel() || '-'}</div>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg bg-gray-50 md:col-span-3">
                    <div className="font-semibold text-gray-900 mb-2">Note</div>
                    <div className="text-gray-900 whitespace-pre-wrap">{form.loan_note || '-'}</div>
                  </div>
                </div>
              </div>
              <div className="md:col-span-2 flex justify-between space-x-4 pt-6 border-t border-gray-200 mt-2">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setStep(7)} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium">Back</button>
                  <button type="button" onClick={handleSaveDraft} disabled={savingDraft} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed">{savingDraft ? 'Saving…' : (<span className="inline-flex items-center"><svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V7l-4-4z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 3v8h10V3"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 13h10v8H7z"/></svg>Save as Draft</span>)}</button>
                </div>
                <button type="submit" disabled={submitting || !!error} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2">
                  {submitting && (
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  <span>{submitting ? 'Creating...' : 'Confirm & Create Loan'}</span>
                </button>
              </div>
            </>)}
          </form>
        </div>
      )}

      <SuccessMessage
        isVisible={successMessage.show}
        onClose={() => setSuccessMessage({ show: false, message: '', type: 'success' })}
        message={successMessage.message}
        type={successMessage.type}
      />

      <ConfirmationModal
        isOpen={showExitConfirm}
        onClose={() => { setShowExitConfirm(false); setPendingExitAction(null); }}
        onConfirm={() => { setShowExitConfirm(false); const act = pendingExitAction; setPendingExitAction(null); act && act(); }}
        title="Discard changes?"
        message="You have unsaved changes. Are you sure you want to leave this page?"
        confirmText="Leave Without Saving"
        cancelText="Continue Editing"
        type="warning"
      />
    </div>
  );
};

export default CreateLoan;


