import React, { useEffect, useState } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  useNavigate,
  useParams,
  useLocation
} from 'react-router-dom';
import Login from './Login';
import Sidebar from './Sidebar';
import Header from './Header';
import './App.css';
import './styles.css';

const apiBase =
  (typeof window !== 'undefined' && window.REACT_APP_API_URL) ||
  process.env.REACT_APP_API_URL ||
  `${window.location.origin}/wp-json`;

function getAuthHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  };
}

// Helper function to extract ID from various formats (matching admin side logic)
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

// Helper function to check if a loan belongs to a borrower profile
const isLoanForBorrower = (loan, profile) => {
  if (!loan || !profile) return false;
  
  const profileId = String(profile.id);
  const profileEmail = (profile.email_address || profile.meta?.email_address || '').toString().toLowerCase().trim();
  
  // Try multiple ways to extract borrower ID from loan (matching admin side logic)
  let borrowerId = toId(loan.meta?.borrower_id) 
    || toId(loan.borrower) 
    || toId(loan.meta?.borrower) 
    || toId(loan.meta?.borrower_profile)
    || toId(loan.fields?.borrower_id) 
    || toId(loan.acf?.borrower_id)
    || toId(loan.fields?.borrower)
    || toId(loan.acf?.borrower);
  
  // Check if borrower ID matches
  if (borrowerId && String(borrowerId) === profileId) {
    return true;
  }
  
  // Fallback: check by email if available
  if (profileEmail) {
    const loanBorrowerEmail = (loan.meta?.borrower_email || loan.fields?.borrower_email || '').toString().toLowerCase().trim();
    if (loanBorrowerEmail && loanBorrowerEmail === profileEmail) {
      return true;
    }
  }
  
  return false;
};

function useCurrentClient(token) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        // 1) Get email from locally stored user (set at login)
        let userEmail = '';
        try {
          const stored = localStorage.getItem('user');
          if (stored) {
            const parsed = JSON.parse(stored);
            userEmail =
              (parsed.user_email || parsed.email || '')
                .toString()
                .toLowerCase()
                .trim();
          }
        } catch (_) {}

        // 2) Fallback to /users/me only if we couldn't get it from localStorage
        if (!userEmail) {
          const meResp = await fetch(`${apiBase}/wp/v2/users/me`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            mode: 'cors',
          });

          if (meResp.ok) {
            const me = await meResp.json();
            userEmail = (
              me.email ||
              me.user_email ||
              me.user_email_address ||
              ''
            )
              .toString()
              .toLowerCase()
              .trim();
          }
        }

        if (!userEmail) {
          throw new Error('Current user email not found');
        }

        // 2) Load all borrowers visible to this token
        const listResp = await fetch(
          `${apiBase}/wp/v2/borrower-profile?per_page=100&context=edit`,
          { headers: getAuthHeaders(token), mode: 'cors' }
        );

        if (!listResp.ok) {
          throw new Error('Failed to load borrower profiles');
        }

        const list = await listResp.json();

        let matched = null;
        if (Array.isArray(list) && list.length) {
          matched =
            list.find((b) => {
              const be = (
                b.email_address ||
                b.email ||
                b.meta?.email_address ||
                b.fields?.email_address ||
                b.meta?.borrower_email ||
                b.fields?.borrower_email ||
                ''
              )
                .toString()
                .toLowerCase()
                .trim();
              return be && be === userEmail;
            }) || null;
        }

        if (!matched) {
          throw new Error('No borrower profile found for this account');
        }

        if (!cancelled) {
          setProfile(matched);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message || 'Failed to load profile');
          setProfile(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return { profile, loading, error };
}

function DashboardPage({ token, user }) {
  const { profile, loading, error } = useCurrentClient(token);
  const [loans, setLoans] = useState([]);
  const [currentLoan, setCurrentLoan] = useState(null);
  const [nextPayment, setNextPayment] = useState(null);
  const [loanPayments, setLoanPayments] = useState([]); // Store next payment for each loan
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [latestNews, setLatestNews] = useState(null);
  const [newsLoading, setNewsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!token || !profile) return;
    const loadLoans = async () => {
      try {
        const resp = await fetch(
          `${apiBase}/wp/v2/loans?per_page=100&context=edit`,
          { headers: getAuthHeaders(token), mode: 'cors' }
        );
        if (!resp.ok) throw new Error('Failed to load loans');
        const data = await resp.json();
        // Use comprehensive filtering function
        const filtered = data.filter((loan) => isLoanForBorrower(loan, profile));
        setLoans(filtered);
        
        // Get active loans
        const activeLoans = filtered.filter(loan => {
          const status = loan.meta?.loan_status || loan.loan_status || '';
          return status && !/^(closed|completed|cancelled)$/i.test(status);
        });
        
        if (activeLoans.length === 0 && filtered.length > 0) {
          // If no active loans, use first loan
          activeLoans.push(filtered[0]);
        }
        
        if (activeLoans.length > 0) {
          setPaymentLoading(true);
          
          // Fetch repayment schedules for all active loans
          const allPayments = [];
          const loanPaymentMap = []; // Store next payment for each loan
          
          for (const loan of activeLoans) {
            try {
              const scheduleResp = await fetch(
                `${apiBase}/echovault/v2/get-repayment-schedule?loan_id=${loan.id}`,
                { headers: { Authorization: `Bearer ${token}` }, mode: 'cors' }
              );
              if (scheduleResp.ok) {
                const scheduleJson = await scheduleResp.json();
                if (scheduleJson.success && scheduleJson.schedule && Array.isArray(scheduleJson.schedule)) {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  
                  const loanPayments = [];
                  
                  // Find all unpaid payments for this loan
                  scheduleJson.schedule.forEach(r => {
                    const status = (r.repayment_status || '').toLowerCase();
                    if (status !== 'paid') {
                      // Use segment_end as payment date (fallback to repayment_date if available)
                      const paymentDateStr = r.segment_end || r.repayment_date || r.end_date;
                      if (paymentDateStr) {
                        try {
                          const paymentDate = new Date(paymentDateStr);
                          paymentDate.setHours(0, 0, 0, 0);
                          const isOverdue = paymentDate < today;
                          
                          const paymentInfo = {
                            ...r,
                            loan: loan,
                            paymentDate: paymentDate,
                            paymentDateStr: paymentDateStr,
                            isOverdue
                          };
                          
                          allPayments.push(paymentInfo);
                          loanPayments.push(paymentInfo);
      } catch (e) {
                          console.error('Error parsing date:', paymentDateStr, e);
                        }
                      }
                    }
                  });
                  
                  // Find next payment for this loan (earliest unpaid payment)
                  if (loanPayments.length > 0) {
                    loanPayments.sort((a, b) => {
                      if (a.isOverdue && !b.isOverdue) return -1;
                      if (!a.isOverdue && b.isOverdue) return 1;
                      return a.paymentDate - b.paymentDate;
                    });
                    loanPaymentMap.push({
                      loan: loan,
                      nextPayment: loanPayments[0]
                    });
                  } else {
                    // No unpaid payments for this loan
                    loanPaymentMap.push({
                      loan: loan,
                      nextPayment: null
                    });
                  }
                }
              }
            } catch (e) {
              console.error(`Failed to load repayment schedule for loan ${loan.id}:`, e);
              loanPaymentMap.push({
                loan: loan,
                nextPayment: null
              });
            }
          }
          
          setLoanPayments(loanPaymentMap);
          
          // Find the most urgent next payment: prioritize overdue first, then closest due date
          if (allPayments.length > 0) {
            // Sort: overdue first, then by date (earliest first)
            allPayments.sort((a, b) => {
              if (a.isOverdue && !b.isOverdue) return -1;
              if (!a.isOverdue && b.isOverdue) return 1;
              return a.paymentDate - b.paymentDate;
            });
            
            const next = allPayments[0];
            setCurrentLoan(next.loan);
            setNextPayment(next);
          } else if (activeLoans.length > 0) {
            // No payments found, but we have active loans - set first active loan
            setCurrentLoan(activeLoans[0]);
          }
          
          setPaymentLoading(false);
        }
      } catch (e) {
        console.error('Failed to load loans:', e);
        setPaymentLoading(false);
      }
    };
    loadLoans();
  }, [token, profile]);

  // Fetch latest news post
  useEffect(() => {
    const loadNews = async () => {
      setNewsLoading(true);
      try {
        // Get the category ID for "system-news" slug
        const categoryResp = await fetch(
          'https://yourfinservices.com.au/wp-json/wp/v2/categories?slug=system-news',
          { mode: 'cors' }
        );
        
        let categoryId = null;
        if (categoryResp.ok) {
          const categories = await categoryResp.json();
          if (categories && categories.length > 0) {
            categoryId = categories[0].id;
          }
        }
        
        // Fetch latest 1 post from the external site
        const postsUrl = categoryId
          ? `https://yourfinservices.com.au/wp-json/wp/v2/posts?categories=${categoryId}&per_page=1&_embed`
          : 'https://yourfinservices.com.au/wp-json/wp/v2/posts?per_page=1&_embed';
        
        const resp = await fetch(postsUrl, {
          mode: 'cors'
        });
        
        if (resp.ok) {
          const data = await resp.json();
          if (data && data.length > 0) {
            setLatestNews(data[0]);
          }
        }
      } catch (e) {
        console.error('Error loading news:', e);
      } finally {
        setNewsLoading(false);
      }
    };
    loadNews();
  }, []);

  const getCurrencyFromLoan = (loan) => {
    if (!loan) return 'AUD';
    return loan.loan_currency || loan.meta?.loan_currency || 'AUD';
  };
  
  const currency = nextPayment?.loan 
    ? getCurrencyFromLoan(nextPayment.loan)
    : (currentLoan?.loan_currency || currentLoan?.meta?.loan_currency || 'AUD');
  const getCurrencySymbol = (c) => (c === 'MNT' ? '₮' : '$');

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'N/A';
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (e) {
      return 'N/A';
    }
  };
  
  const getFullName = () => {
    if (!profile) return user?.username || 'Client';
    const firstName = profile.first_name || profile.meta?.first_name || '';
    const lastName = profile.last_name || profile.meta?.last_name || '';
    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    }
    return firstName || lastName || profile.title?.rendered || user?.username || 'Client';
  };

  const getStatusBadge = (payment) => {
    if (!payment) return null;
    
    let status = payment.repayment_status || 'Pending';
    if (payment.isOverdue && status !== 'Paid') {
      status = 'Overdue';
    }
    
    const statusConfig = {
      'Paid': { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300', icon: '✓' },
      'Overdue': { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300', icon: '⚠' },
      'Partial': { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300', icon: '◐' },
      'Pending': { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300', icon: '○' }
    };
    
    const config = statusConfig[status] || statusConfig['Pending'];

  return (
      <div className={`inline-flex items-center px-4 py-2 rounded-lg border-2 ${config.bg} ${config.text} ${config.border} font-bold text-sm`}>
        <span className="mr-2">{config.icon}</span>
        <span>{status}</span>
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
      <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Dashboard</h1>
            <p className="text-gray-600">
              Welcome back, {getFullName()}
            </p>
          </div>
        </div>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading profile...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Next Payment and News Section - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8 items-stretch">
        {/* Next Payment Section - 3/4 width */}
        <div className="lg:col-span-3 flex">
          {paymentLoading && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 w-full">
              <p className="text-sm text-gray-500">Loading payment information...</p>
            </div>
          )}
          
          {!paymentLoading && currentLoan && nextPayment && (
            <div className={`rounded-lg border-2 p-6 w-full flex flex-col ${
              nextPayment.isOverdue 
                ? 'bg-red-50 border-red-300' 
                : 'bg-white border-gray-200'
            }`}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Next Payment</h2>
              <p className="text-sm text-gray-600">
                {currentLoan.title?.rendered || currentLoan.loan_title || `Loan #${currentLoan.id}`}
                {loans.length > 1 && (
                  <span className="ml-2 text-xs text-gray-500">
                    ({loans.length} active {loans.length === 1 ? 'loan' : 'loans'})
                  </span>
                )}
              </p>
        </div>
            {getStatusBadge(nextPayment)}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Payment Date</p>
              <p className={`text-lg font-semibold ${
                nextPayment.isOverdue ? 'text-red-700' : 'text-gray-900'
              }`}>
                {formatDate(nextPayment.paymentDateStr)}
              </p>
              {nextPayment.isOverdue && (
                <p className="text-xs text-red-600 mt-1 font-medium">⚠ Past due date</p>
              )}
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Total Payment Amount</p>
              <p className="text-2xl font-bold text-gray-900">
                {getCurrencySymbol(currency)}{(() => {
                  // Calculate total payment: use total_payment if available and > 0, otherwise sum principal + interest
                  const totalPayment = parseFloat(nextPayment.total_payment || 0);
                  if (totalPayment > 0) {
                    return totalPayment.toFixed(2);
                  }
                  // Fallback: calculate from principal + interest
                  const principal = parseFloat(nextPayment.paid_principles || nextPayment.paid_principal || 0);
                  const interest = parseFloat(nextPayment.accrued_interest || nextPayment.paid_interest || 0);
                  const calculated = principal + interest;
                  return calculated > 0 ? calculated.toFixed(2) : '0.00';
                })()}
              </p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Interest Amount</p>
              <p className="text-lg font-semibold text-gray-900">
                {getCurrencySymbol(currency)}{parseFloat(nextPayment.accrued_interest || nextPayment.paid_interest || 0).toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Principal: {getCurrencySymbol(currency)}{parseFloat(nextPayment.paid_principles || nextPayment.paid_principal || 0).toFixed(2)}
              </p>
            </div>
          </div>
          
          {nextPayment.isOverdue && (
            <div className="mt-4 p-4 bg-red-100 border border-red-300 rounded-lg">
              <p className="text-sm font-medium text-red-800">
                ⚠ This payment is overdue. Please make payment as soon as possible to avoid additional fees.
              </p>
            </div>
          )}
          
          <div className="mt-auto pt-4">
            <button
              onClick={() => navigate(`/loans/${currentLoan.id}`)}
              className="text-blue-600 hover:text-blue-700 font-medium text-sm inline-flex items-center"
            >
              View full loan details
              <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
        </div>
      </div>
          )}
          
          {!paymentLoading && currentLoan && !nextPayment && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 w-full flex flex-col">
              <p className="text-gray-600">No upcoming payments found for your current loan.</p>
    </div>
          )}
        </div>

        {/* Latest News Card - 1/4 width */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden h-full">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Latest News</h2>
                <button
                  onClick={() => navigate('/news')}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  View all
                </button>
              </div>
            </div>
            
            {newsLoading ? (
              <div className="p-4">
                <p className="text-xs text-gray-500">Loading news...</p>
              </div>
            ) : latestNews ? (
              <div 
                className="cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => {
                  if (latestNews.link) {
                    window.open(latestNews.link, '_blank', 'noopener,noreferrer');
                  }
                }}
              >
                {(() => {
                  // Get featured image if available
                  const getFeaturedImage = (post) => {
                    if (!post) return null;
                    
                    const embeddedMedia = post._embedded?.['wp:featuredmedia']?.[0];
                    if (embeddedMedia) {
                      if (embeddedMedia.source_url) return embeddedMedia.source_url;
                      if (embeddedMedia.media_details?.sizes) {
                        const sizes = embeddedMedia.media_details.sizes;
                        if (sizes.large?.source_url) return sizes.large.source_url;
                        if (sizes['medium_large']?.source_url) return sizes['medium_large'].source_url;
                        if (sizes.medium?.source_url) return sizes.medium.source_url;
                        if (sizes.full?.source_url) return sizes.full.source_url;
                      }
                    }
                    if (post.featured_media_url) return post.featured_media_url;
                    return null;
                  };
                  
                  const featuredImage = getFeaturedImage(latestNews);
                  const excerpt = latestNews.excerpt?.rendered || latestNews.content?.rendered || '';
                  const textContent = excerpt.replace(/<[^>]*>/g, '').substring(0, 100);
                  
                  return (
                    <>
                      {featuredImage && (
                        <div className="w-full h-40 overflow-hidden bg-gray-100">
                          <img 
                            src={featuredImage} 
                            alt={latestNews.title?.rendered || 'News image'}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      <div className="p-4">
                        <h3 className="text-sm font-semibold text-gray-900 mb-2 line-clamp-2">
                          {latestNews.title?.rendered || 'News'}
                        </h3>
                        <p className="text-xs text-gray-500 mb-2">
                          {new Date(latestNews.date).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </p>
                        {textContent && (
                          <p className="text-xs text-gray-600 line-clamp-3">
                            {textContent}...
                          </p>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="p-4">
                <p className="text-xs text-gray-500">No news available</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Loans</p>
              <p className="text-2xl font-bold text-gray-900">{loans.length}</p>
            </div>
          </div>
        </div>
        
        {currentLoan && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Current Loan Balance</p>
                <p className="text-2xl font-bold text-gray-900">
                  {getCurrencySymbol(currency)}{parseFloat(currentLoan.remaining_balance || currentLoan.meta?.remaining_balance || currentLoan.loan_amount || currentLoan.meta?.loan_amount || 0).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        )}
        
        {nextPayment && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className={`p-3 rounded-lg ${
                nextPayment.isOverdue ? 'bg-red-100' : 'bg-purple-100'
              }`}>
                <svg className={`w-6 h-6 ${nextPayment.isOverdue ? 'text-red-600' : 'text-purple-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Days Until Payment</p>
                <p className={`text-2xl font-bold ${
                  nextPayment.isOverdue ? 'text-red-600' : 'text-gray-900'
                }`}>
                  {(() => {
                    if (!nextPayment.paymentDate) return 'N/A';
                    try {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const paymentDate = new Date(nextPayment.paymentDate);
                      paymentDate.setHours(0, 0, 0, 0);
                      const diffTime = paymentDate - today;
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                      if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`;
                      if (diffDays === 0) return 'Due today';
                      return `${diffDays} days`;
                    } catch (e) {
                      return 'N/A';
                    }
                  })()}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* All Loans Section - Show when user has multiple loans */}
      {loans.length > 1 && loanPayments.length > 0 && (
        <div className="mb-8">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-900">All Loans</h2>
            <p className="text-sm text-gray-600 mt-1">View status and next payment for all your loans</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loanPayments.map(({ loan, nextPayment: loanNextPayment }) => {
              const loanCurrency = loan.loan_currency || loan.meta?.loan_currency || 'AUD';
              const loanCurrencySymbol = getCurrencySymbol(loanCurrency);
              const loanBalance = parseFloat(loan.remaining_balance || loan.meta?.remaining_balance || loan.loan_amount || loan.meta?.loan_amount || 0);
              const loanStatus = loan.meta?.loan_status || loan.loan_status || 'Active';
              
              // Calculate total payment for display
              const getTotalPayment = (payment) => {
                if (!payment) return 0;
                const totalPayment = parseFloat(payment.total_payment || 0);
                if (totalPayment > 0) return totalPayment;
                const principal = parseFloat(payment.paid_principles || payment.paid_principal || 0);
                const interest = parseFloat(payment.accrued_interest || payment.paid_interest || 0);
                return principal + interest;
              };
              
              // Calculate days until payment
              const getDaysUntilPayment = (payment) => {
                if (!payment || !payment.paymentDate) return 'N/A';
                try {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const paymentDate = new Date(payment.paymentDate);
                  paymentDate.setHours(0, 0, 0, 0);
                  const diffTime = paymentDate - today;
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`;
                  if (diffDays === 0) return 'Due today';
                  return `${diffDays} days`;
                } catch (e) {
                  return 'N/A';
                }
              };
              
              const isCurrentLoan = currentLoan && currentLoan.id === loan.id;
              
              return (
                <div
                  key={loan.id}
                  className={`bg-white rounded-lg border-2 p-5 cursor-pointer transition-all hover:shadow-md ${
                    isCurrentLoan
                      ? 'border-blue-500 bg-blue-50'
                      : loanNextPayment?.isOverdue
                      ? 'border-red-300 bg-red-50'
                      : 'border-gray-200'
                  }`}
                  onClick={() => navigate(`/loans/${loan.id}`)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">
                        {loan.title?.rendered || loan.loan_title || `Loan #${loan.id}`}
                      </h3>
                      {isCurrentLoan && (
                        <span className="inline-block px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                          Most Urgent
                        </span>
                      )}
                    </div>
                    {loanNextPayment && getStatusBadge(loanNextPayment)}
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className="font-medium text-gray-900">{loanStatus}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-gray-600">Balance:</span>
                      <span className="font-medium text-gray-900">
                        {loanCurrencySymbol}{loanBalance.toFixed(2)}
                      </span>
                    </div>
                    
                    {loanNextPayment ? (
                      <>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Next Payment:</span>
                          <span className={`font-medium ${
                            loanNextPayment.isOverdue ? 'text-red-600' : 'text-gray-900'
                          }`}>
                            {formatDate(loanNextPayment.paymentDateStr)}
                          </span>
                        </div>
                        
                        <div className="flex justify-between">
                          <span className="text-gray-600">Amount:</span>
                          <span className="font-semibold text-gray-900">
                            {loanCurrencySymbol}{getTotalPayment(loanNextPayment).toFixed(2)}
                          </span>
                        </div>
                        
                        <div className="flex justify-between">
                          <span className="text-gray-600">Days:</span>
                          <span className={`font-medium ${
                            loanNextPayment.isOverdue ? 'text-red-600' : 'text-gray-900'
                          }`}>
                            {getDaysUntilPayment(loanNextPayment)}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-2 text-gray-500 text-xs">
                        No upcoming payments
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-4 pt-3 border-t border-gray-200">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/loans/${loan.id}`);
                      }}
                      className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      View Details →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function LoansPage({ token }) {
  const { profile } = useCurrentClient(token);
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!token || !profile) return;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const resp = await fetch(
          `${apiBase}/wp/v2/loans?per_page=100&context=edit`,
          { headers: getAuthHeaders(token), mode: 'cors' }
        );
        if (!resp.ok) throw new Error('Failed to load loans');
        const data = await resp.json();
        // Use comprehensive filtering function
        const filtered = data.filter((loan) => isLoanForBorrower(loan, profile));
        setLoans(filtered);
      } catch (e) {
        setError(e.message || 'Failed to load loans');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token, profile]);

  return (
    <div className="p-6">
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
      <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">My Loans</h1>
            <p className="text-gray-600">View your active and past loans.</p>
          </div>
          <button
            onClick={() => navigate('/products')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 self-start sm:self-center"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>Apply a new loan</span>
          </button>
        </div>
      </div>
      {loading && <p className="text-sm text-gray-500">Loading loans...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && loans.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-600">You do not have any loans yet.</p>
        </div>
      )}
      {loans.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loan</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Balance</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Remaining Balance</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loans.map((loan) => {
                const currency = loan?.loan_currency || loan?.meta?.loan_currency || 'AUD';
                const getCurrencySymbol = (c) => (c === 'MNT' ? '₮' : '$');
                const totalBalance = loan.loan_amount || loan.meta?.loan_amount || 0;
                const remainingBalance = loan.remaining_balance || loan.meta?.remaining_balance || loan.meta?.remain_balance || totalBalance;
                
                return (
                <tr key={loan.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {loan.title?.rendered || loan.loan_title || `Loan #${loan.id}`}
                  </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {getCurrencySymbol(currency)}{parseFloat(totalBalance).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {getCurrencySymbol(currency)}{parseFloat(remainingBalance).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {loan.meta?.loan_status || 'Active'}
                  </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => navigate(`/loans/${loan.id}`)}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      View details
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LoanDetailPage({ token }) {
  const { id } = useParams();
  const { profile } = useCurrentClient(token);
  const [activeTab, setActiveTab] = useState('Loan Details');
  const [loan, setLoan] = useState(null);
  const [coBorrower, setCoBorrower] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!token || !id || !profile) return;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const loanResp = await fetch(
          `${apiBase}/wp/v2/loans/${id}?context=edit`,
          { headers: getAuthHeaders(token), mode: 'cors' }
        );
        if (!loanResp.ok) throw new Error('Failed to load loan');
        const loanJson = await loanResp.json();
        
        // Security check: verify this loan belongs to the current user
        if (!isLoanForBorrower(loanJson, profile)) {
          setError('You do not have permission to view this loan.');
          setLoading(false);
          return;
        }
        
        setLoan(loanJson);

        // Fetch co-borrower if exists
        const coStatus = loanJson.co_borrower_status || loanJson.meta?.co_borrower_status;
        const coId = toId(loanJson.meta?.co_borrower_id) || toId(loanJson.co_borrower) || toId(loanJson.meta?.co_borrower);
        if (coStatus && /^yes$/i.test(String(coStatus)) && coId) {
          try {
            const cbResp = await fetch(
              `${apiBase}/wp/v2/borrower-profile/${coId}?context=edit`,
              { headers: getAuthHeaders(token), mode: 'cors' }
            );
            if (cbResp.ok) {
              setCoBorrower(await cbResp.json());
            }
          } catch (e) {
            console.error('Failed to load co-borrower:', e);
          }
        }

        const scheduleResp = await fetch(
          `${apiBase}/echovault/v2/get-repayment-schedule?loan_id=${id}`,
          { headers: { Authorization: `Bearer ${token}` }, mode: 'cors' }
        );
        if (scheduleResp.ok) {
          const scheduleJson = await scheduleResp.json();
          if (scheduleJson.success && scheduleJson.schedule) {
            setSchedule(scheduleJson.schedule);
          }
        }
      } catch (e) {
        setError(e.message || 'Failed to load loan');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token, id, profile]);

  const currency = loan?.loan_currency || loan?.meta?.loan_currency || 'AUD';
  const getCurrencySymbol = (c) => (c === 'MNT' ? '₮' : '$');

  return (
    <div className="p-6">
      <div className="mb-8">
        <button
          onClick={() => navigate('/loans')}
          className="text-sm text-gray-600 hover:text-gray-900 mb-4 inline-flex items-center"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Loans
        </button>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Loan Details</h1>
      </div>
      {loading && <p className="text-sm text-gray-500">Loading...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      
      {loan && (
        <>
          {/* Tabs Navigation */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8 px-6">
                <button
                  type="button"
                  onClick={() => setActiveTab('Loan Details')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'Loan Details'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Loan Details
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('Repayment Schedule')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'Repayment Schedule'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Repayment Schedule
                </button>
              </nav>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'Loan Details' && (
            <>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Loan ID</p>
                    <p className="font-medium text-gray-900 mt-1">
            {loan.title?.rendered || loan.loan_title || `Loan #${loan.id}`}
          </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Status</p>
                    <p className="font-medium text-gray-900 mt-1">
                      {loan.meta?.loan_status || 'Active'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Repayment Status</p>
                    <div className="mt-1">
                      {(() => {
                        // Calculate overall repayment status from schedule
                        let overallStatus = 'Pending';
                        if (schedule && schedule.length > 0) {
                          const paidCount = schedule.filter(s => s.repayment_status === 'Paid').length;
                          const partialCount = schedule.filter(s => s.repayment_status === 'Partial').length;
                          const overdueCount = schedule.filter(s => s.repayment_status === 'Overdue').length;
                          
                          if (paidCount === schedule.length) {
                            overallStatus = 'Paid';
                          } else if (overdueCount > 0) {
                            overallStatus = 'Overdue';
                          } else if (partialCount > 0 || paidCount > 0) {
                            overallStatus = 'Partial';
                          } else {
                            overallStatus = 'Pending';
                          }
                        }
                        
                        const statusClass = 
                          overallStatus === 'Paid' ? 'bg-green-100 text-green-800' :
                          overallStatus === 'Partial' ? 'bg-yellow-100 text-yellow-800' :
                          overallStatus === 'Overdue' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800';
                        
                        return (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass}`}>
                            {overallStatus}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  <div>
                    <p className="text-gray-500">Loan Amount</p>
                    <p className="font-medium text-gray-900 mt-1">
                      {getCurrencySymbol(currency)}{loan.loan_amount || loan.meta?.loan_amount || '0'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Currency</p>
                    <p className="font-medium text-gray-900 mt-1">{currency}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Loan Product</p>
                    <p className="font-medium text-gray-900 mt-1">
                      {loan.loan_product || loan.meta?.loan_product_name || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Loan Interest</p>
                    <p className="font-medium text-gray-900 mt-1">
                      {loan.loan_interest || loan.meta?.loan_interest || '-'}%
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Loan Term</p>
                    <p className="font-medium text-gray-900 mt-1">
                      {loan.loan_term || loan.meta?.loan_term ? `${loan.loan_term || loan.meta?.loan_term} months` : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Repayment Method</p>
                    <p className="font-medium text-gray-900 mt-1">
                      {loan.repayment_method || loan.meta?.repayment_method || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Repayment Frequency</p>
                    <p className="font-medium text-gray-900 mt-1">
                      {Array.isArray(loan.repayment_frequency) ? loan.repayment_frequency[0] : (loan.repayment_frequency || loan.meta?.repayment_frequency || '-')}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Loan Start Date</p>
                    <p className="font-medium text-gray-900 mt-1">
                      {loan.start_date || loan.meta?.start_date || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Loan End Date</p>
                    <p className="font-medium text-gray-900 mt-1">
                      {loan.end_date || loan.meta?.end_date || '-'}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Repayment Account Details */}
              {(loan.loan_repayment_account || loan.meta?.loan_repayment_account) && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Repayment Account Details</h2>
                  <div className="text-sm">
                    <p className="text-gray-500">Repayment Account</p>
                    <p className="font-medium text-gray-900 mt-1 break-all">
                      {loan.loan_repayment_account || loan.meta?.loan_repayment_account || '-'}
                    </p>
                  </div>
        </div>
      )}

              {/* Co-borrower Details */}
              {coBorrower && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Co-borrower Details</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">First Name</p>
                      <p className="font-medium text-gray-900 mt-1">
                        {coBorrower.first_name || coBorrower.meta?.first_name || '-'}
                      </p>
          </div>
                    <div>
                      <p className="text-gray-500">Last Name</p>
                      <p className="font-medium text-gray-900 mt-1">
                        {coBorrower.last_name || coBorrower.meta?.last_name || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Email Address</p>
                      <p className="font-medium text-gray-900 mt-1 break-all">
                        {coBorrower.email_address || coBorrower.meta?.email_address || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Mobile Number</p>
                      <p className="font-medium text-gray-900 mt-1">
                        {coBorrower.mobile_number || coBorrower.meta?.mobile_number || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Date of Birth</p>
                      <p className="font-medium text-gray-900 mt-1">
                        {coBorrower.date_of_birth || coBorrower.meta?.date_of_birth || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Document Type</p>
                      <p className="font-medium text-gray-900 mt-1">
                        {coBorrower.document_type || coBorrower.meta?.document_type || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Document Number</p>
                      <p className="font-medium text-gray-900 mt-1">
                        {coBorrower.document_number || coBorrower.meta?.document_number || '-'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'Repayment Schedule' && (
            <>
              {schedule.length > 0 ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Repayment Schedule</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-xs">
            <thead className="bg-gray-50">
              <tr>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">#</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Start</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">End</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Days</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Start Balance</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Accrued Interest</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Paid Interest</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Paid Principal</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total Payment</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Outstanding</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Remain Balance</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
              <tbody className="bg-white divide-y divide-gray-200">
              {schedule.map((r, index) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-center">{index + 1}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{r.segment_start || '-'}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{r.segment_end || '-'}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right">{r.loan_days || 0}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
                      {getCurrencySymbol(currency)}{(r.start_balance || 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
                      {getCurrencySymbol(currency)}{(r.accrued_interest || 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
                      {getCurrencySymbol(currency)}{(r.paid_interest || 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
                      {getCurrencySymbol(currency)}{(r.paid_principles || 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
                      {getCurrencySymbol(currency)}{(r.total_payment || 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
                      {getCurrencySymbol(currency)}{(r.outstanding_interest || 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
                      {getCurrencySymbol(currency)}{(r.remain_balance || 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-center">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        r.repayment_status === 'Paid' ? 'bg-green-100 text-green-800' :
                        r.repayment_status === 'Partial' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                    {r.repayment_status || 'Pending'}
                      </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
              ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                  <p className="text-gray-600">No repayment schedule available.</p>
        </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function ProductsPage({ token }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const resp = await fetch(
          `${apiBase}/wp/v2/loan-product?per_page=100&status=publish`,
          { headers: getAuthHeaders(token), mode: 'cors' }
        );
        if (!resp.ok) throw new Error('Failed to load products');
        const data = await resp.json();
        setProducts(data || []);
      } catch (e) {
        setError(e.message || 'Failed to load products');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  return (
    <div className="p-6">
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Active Loan Products</h1>
            <p className="text-gray-600">Browse available loan products.</p>
          </div>
        </div>
      </div>
      {loading && <p className="text-sm text-gray-500">Loading products...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && products.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-600">No active products available.</p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((p) => (
          <div
            key={p.id}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {p.product_name || p.title?.rendered || 'Loan Product'}
            </h3>
            {p.product_description && (
              <p className="text-sm text-gray-600 mb-4">{p.product_description}</p>
            )}
            <div className="space-y-2 text-sm">
              {p.min_amount && (
                <p className="text-gray-600">
                  <span className="font-medium">Min Amount:</span> ${p.min_amount}
                </p>
              )}
              {p.max_amount && (
                <p className="text-gray-600">
                  <span className="font-medium">Max Amount:</span> ${p.max_amount}
                </p>
              )}
              {p.interest_rate && (
                <p className="text-gray-600">
                  <span className="font-medium">Interest Rate:</span> {p.interest_rate}%
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NewsPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        // First, get the category ID for "system-news" slug
        const categoryResp = await fetch(
          'https://yourfinservices.com.au/wp-json/wp/v2/categories?slug=system-news',
          { mode: 'cors' }
        );
        
        let categoryId = null;
        if (categoryResp.ok) {
          const categories = await categoryResp.json();
          if (categories && categories.length > 0) {
            categoryId = categories[0].id;
          }
        }
        
        // Fetch posts from the external site
        // If category found, filter by category, otherwise fetch all posts
        const postsUrl = categoryId
          ? `https://yourfinservices.com.au/wp-json/wp/v2/posts?categories=${categoryId}&per_page=20&_embed`
          : 'https://yourfinservices.com.au/wp-json/wp/v2/posts?per_page=20&_embed';
        
        const resp = await fetch(postsUrl, {
          mode: 'cors'
        });
        
        if (!resp.ok) {
          throw new Error('Failed to load news');
        }
        
        const data = await resp.json();
        setPosts(data || []);
      } catch (e) {
        console.error('Error loading news:', e);
        setError(e.message || 'Failed to load news');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="p-6">
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">News</h1>
            <p className="text-gray-600">Latest updates and announcements.</p>
          </div>
        </div>
      </div>
      {loading && <p className="text-sm text-gray-500">Loading news...</p>}
      {error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">{error}</p>
          <p className="text-xs text-yellow-600 mt-1">
            Unable to load news from external source. Please try again later.
          </p>
        </div>
      )}
      
      {!loading && !error && posts.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-600">No news articles found.</p>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {posts.map((post) => {
          // Get featured image if available - try multiple paths
          const getFeaturedImage = (post) => {
            if (!post) return null;
            
            // Try embedded media
            const embeddedMedia = post._embedded?.['wp:featuredmedia']?.[0];
            if (embeddedMedia) {
              // Try source_url first
              if (embeddedMedia.source_url) return embeddedMedia.source_url;
              // Try media_details sizes
              if (embeddedMedia.media_details?.sizes) {
                const sizes = embeddedMedia.media_details.sizes;
                // Try large, medium_large, medium, or full
                if (sizes.large?.source_url) return sizes.large.source_url;
                if (sizes['medium_large']?.source_url) return sizes['medium_large'].source_url;
                if (sizes.medium?.source_url) return sizes.medium.source_url;
                if (sizes.full?.source_url) return sizes.full.source_url;
              }
            }
            
            // Try direct featured_media_url
            if (post.featured_media_url) return post.featured_media_url;
            
            return null;
          };
          
          const featuredImage = getFeaturedImage(post);
          
          // Get excerpt or content
          const excerpt = post.excerpt?.rendered || post.content?.rendered || '';
          // Strip HTML tags for preview (keep first 120 chars for grid layout)
          const textContent = excerpt.replace(/<[^>]*>/g, '').substring(0, 120);
          
          return (
            <article key={post.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
              {featuredImage && (
                <div className="w-full h-40 overflow-hidden bg-gray-100">
                  <img 
                    src={featuredImage} 
                    alt={post.title?.rendered || 'News image'}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              )}
              <div className="p-4 flex-1 flex flex-col">
                <h3 className="text-base font-semibold text-gray-900 mb-2 line-clamp-2">
              {post.title?.rendered || 'News'}
            </h3>
                <p className="text-xs text-gray-500 mb-2">
                  {new Date(post.date).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </p>
                <div className="text-xs text-gray-600 mb-3 flex-1 line-clamp-3">
                  {textContent}
                  {textContent.length >= 120 && '...'}
                </div>
                {post.link && (
                  <a
                    href={post.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-xs text-blue-600 hover:text-blue-700 font-medium mt-auto"
                  >
                    Read more
                    <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </a>
                )}
              </div>
          </article>
          );
        })}
      </div>
    </div>
  );
}

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

function ProfilePage({ token }) {
  const { profile, loading, error } = useCurrentClient(token);
  const [activeTab, setActiveTab] = useState('general');

  const field = (val) =>
    val === null || val === undefined || val === '' ? '-' : String(val);

  const fullName = profile 
    ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown Client'
    : 'Unknown Client';
  const initials = fullName.split(' ').map(n => n[0]).join('').toUpperCase();

  return (
    <div className="p-6">
      {loading && <p className="text-sm text-gray-500">Loading profile...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && !profile && (
        <p className="text-sm text-gray-500">
          No client profile is linked to this account yet.
        </p>
      )}

      {profile && (
        <>
          {/* Header - matching admin side */}
          <div className="mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="flex items-center">
                <div className="flex items-center">
                  <img
                    src={getAvatarByBorrowerId(profile)}
                    alt={fullName}
                    className="w-16 h-16 rounded-full object-cover mr-4"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                  <div 
                    className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl mr-4 hidden"
                  >
                    {initials}
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-1">
                      {fullName}
                    </h1>
                    <div className="flex items-center gap-4">
                      <p className="text-gray-600">ID: {profile.id || '-'}</p>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Active
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {/* Tabs */}
            <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              <button
                type="button"
                onClick={() => setActiveTab('general')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'general'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                General Information
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('visa')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'visa'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Visa Status
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('employment')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'employment'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Employment
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('family')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'family'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Family Information
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('bank')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'bank'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Bank Details
              </button>
            </nav>
          </div>

          {/* Tab content – read only */}
          <div className="p-6 text-sm text-gray-900">
            {activeTab === 'general' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-gray-500 mb-1">First Name</p>
                  <p className="font-medium">{field(profile.first_name)}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Last Name</p>
                  <p className="font-medium">{field(profile.last_name)}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Email</p>
                  <p className="font-medium">{field(profile.email_address)}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Borrower ID</p>
                  <p className="font-medium">
                    {field(profile.borrower_id || profile.meta?.borrower_id)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Date of Birth</p>
                  <p className="font-medium">{field(profile.date_of_birth)}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Mobile Number</p>
                  <p className="font-medium">{field(profile.mobile_number)}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Registration Number</p>
                  <p className="font-medium">
                    {field(profile.registration_number)}
                  </p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-gray-500 mb-1">Home Address</p>
                  <p className="font-medium whitespace-pre-line">
                    {field(profile.home_address)}
                  </p>
                </div>
        </div>
            )}

            {activeTab === 'visa' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-gray-500 mb-1">Visa Type</p>
                  <p className="font-medium">{field(profile.visa_type)}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Visa Expiry Date</p>
                  <p className="font-medium">
                    {field(profile.visa_expiry_date)}
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'employment' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-gray-500 mb-1">Employment Status</p>
                  <p className="font-medium">
                    {field(profile.employment_status)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Work Rights</p>
                  <p className="font-medium">{field(profile.work_rights)}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Employer Name</p>
                  <p className="font-medium">{field(profile.employer_name)}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Job Title</p>
                  <p className="font-medium">{field(profile.job_title)}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Monthly Income (AUD)</p>
                  <p className="font-medium">
                    {field(profile.monthly_income_aud)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Employment Start Date</p>
                  <p className="font-medium">
                    {field(profile.employment_start_date)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Employer Phone</p>
                  <p className="font-medium">
                    {field(profile.employer_phone)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Employer Email</p>
                  <p className="font-medium">
                    {field(profile.employer_email)}
                  </p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-gray-500 mb-1">Employer Address</p>
                  <p className="font-medium whitespace-pre-line">
                    {field(profile.employer_address)}
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'family' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-gray-500 mb-1">Marital Status</p>
                  <p className="font-medium">
                    {field(profile.marital_status)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Family Relationship</p>
                  <p className="font-medium">
                    {field(profile.family_relationship)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Family Member Name</p>
                  <p className="font-medium">
                    {field(profile.family_member_full_name)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Family Member Phone</p>
                  <p className="font-medium">
                    {field(profile.family_member_phone)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Family Member Email</p>
                  <p className="font-medium">
                    {field(profile.family_member_email)}
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'bank' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-gray-500 mb-1">Bank Name</p>
                  <p className="font-medium">{field(profile.bank_name)}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Account Name</p>
                  <p className="font-medium">{field(profile.account_name)}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">BSB Number</p>
                  <p className="font-medium">{field(profile.bsb_number)}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Account Number</p>
                  <p className="font-medium">{field(profile.account_number)}</p>
                </div>
              </div>
            )}
          </div>
        </div>
        </>
      )}
    </div>
  );
}

function ClientApp() {
  const [token, setToken] = useState(localStorage.getItem('jwt_token'));
  const [user, setUser] = useState(() => {
    try {
      const s = localStorage.getItem('user');
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  });
  const { profile } = useCurrentClient(token);
  const location = useLocation();

  const getCurrentView = () => {
    const path = location.pathname;
    if (path === '/' || path === '/dashboard') return 'dashboard';
    if (path.startsWith('/loans')) return 'loans';
    if (path === '/products') return 'products';
    if (path === '/news') return 'news';
    if (path === '/profile') return 'profile';
    return 'dashboard';
  };

  const handleLogout = () => {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user');
    window.location.reload();
  };

  if (!token) {
    return (
      <Login
        onLoginSuccess={(newToken, userData) => {
          setToken(newToken);
          setUser(userData);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        <Sidebar currentView={getCurrentView()} />
        <div className="flex-1 flex flex-col">
          <Header user={user} profile={profile} onLogout={handleLogout} />
        <Routes>
            <Route path="/" element={<DashboardPage token={token} user={user} />} />
            <Route path="/dashboard" element={<DashboardPage token={token} user={user} />} />
          <Route path="/loans" element={<LoansPage token={token} />} />
          <Route path="/loans/:id" element={<LoanDetailPage token={token} />} />
          <Route path="/products" element={<ProductsPage token={token} />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/profile" element={<ProfilePage token={token} />} />
        </Routes>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ClientApp />
    </BrowserRouter>
  );
}

export default App;
