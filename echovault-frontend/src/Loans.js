import React from 'react';

const Loans = ({ onCreateNew, setCurrentView }) => {
  const Card = ({ title, subtitle, onClick, icon }) => (
    <button
      onClick={onClick}
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-left hover:shadow transition flex items-start gap-4 w-full"
    >
      <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
        {icon}
      </div>
      <div>
        <div className="text-lg font-semibold text-gray-900">{title}</div>
        <div className="text-sm text-gray-600 mt-1">{subtitle}</div>
      </div>
    </button>
  );

  return (
    <div>
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Loans</h1>
            <p className="text-gray-600">Manage and view loan applications and approvals</p>
          </div>
          <button
            onClick={() => setCurrentView('loans-create')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 self-start sm:self-center"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>Create New Loan</span>
          </button>
        </div>
      </div>

      {/* Sub-pages links in a standard card container */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card
            title="Loans"
            subtitle="View and manage currently active loans."
            onClick={() => setCurrentView('loans-active')}
            icon={(
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h10M5 19h14M7 6h10M12 3v3" />
              </svg>
            )}
          />
          <Card
            title="Loan Requests"
            subtitle="Review and process incoming loan requests."
            onClick={() => setCurrentView('loan-requests')}
            icon={(
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            )}
          />
          <Card
            title="Loan Calculator"
            subtitle="Estimate repayments and terms."
            onClick={() => setCurrentView('loan-calculator')}
            icon={(
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h10M7 11h10M9 15h6M9 19h6" />
              </svg>
            )}
          />
        </div>
      </div>
    </div>
  );
};

export default Loans;
