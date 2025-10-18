/**
 * Verification utility for borrower profiles
 * Checks if ALL fields are filled - if ANY field is empty, it's not 100% verified
 */

/**
 * Check if a field has actual content (not empty, null, undefined, or placeholder text)
 */
const hasContent = (value) => {
  if (value === null || value === undefined) {
    return false;
  }
  
  const str = String(value).trim();
  
  // Check for empty or placeholder values
  if (str === '' || 
      str === 'null' || 
      str === 'undefined' || 
      str === 'N/A' || 
      str === 'n/a' ||
      str === 'Not provided' ||
      str === 'not provided') {
    return false;
  }
  
  return true;
};

/**
 * Check if email is valid format
 */
const isValidEmailFormat = (email) => {
  if (!hasContent(email)) {
    return false;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(String(email).trim());
};

/**
 * Get verification status for a borrower
 * Checks ALL fields - if ANY field is empty, it's not 100% verified
 */
export const getVerificationStatus = (borrower) => {
  if (!borrower || typeof borrower !== 'object') {
    return { status: 'Pending', color: 'red', percentage: 0 };
  }

  // List of ALL fields that should be checked
  const fieldsToCheck = [
    // Basic info
    'first_name',
    'last_name', 
    'email_address',
    'date_of_birth',
    'mobile_number',
    'registration_number',
    'home_address',
    'document_type',
    
    // Social links
    'social_link_1',
    'social_link_2',
    
    // Employment
    'employment_status',
    'work_rights',
    'employer_name',
    'job_title',
    'monthly_income_aud',
    'employment_start_date',
    'employer_phone',
    'employer_email',
    'employer_address',
    
    // Family
    'marital_status',
    'family_relationship',
    'family_member_full_name',
    'family_member_phone',
    'family_member_email',
    
    // Bank
    'bank_name',
    'account_name',
    'bsb_number',
    'account_number'
  ];

  // Count how many fields have content
  let completedFields = 0;
  let totalFields = 0;

  fieldsToCheck.forEach(fieldName => {
    const value = borrower[fieldName];
    
    // Special handling for email field
    if (fieldName === 'email_address') {
      if (isValidEmailFormat(value)) {
        completedFields++;
      }
      totalFields++;
    }
    // Regular field check
    else if (hasContent(value)) {
      completedFields++;
      totalFields++;
    } else {
      totalFields++;
    }
  });

  // Calculate percentage
  const percentage = totalFields > 0 ? Math.round((completedFields / totalFields) * 100) : 0;

  // Return status based on completion
  if (percentage === 100) {
    return { status: 'Verified', color: 'green', percentage };
  } else if (percentage >= 75) {
    return { status: 'Almost Complete', color: 'blue', percentage };
  } else if (percentage >= 50) {
    return { status: 'In Progress', color: 'yellow', percentage };
  } else {
    return { status: 'Pending', color: 'red', percentage };
  }
};

/**
 * Get verification statistics for multiple borrowers
 */
export const getVerificationStats = (borrowers) => {
  if (!borrowers || !Array.isArray(borrowers)) {
    return {
      total: 0,
      verified: 0,
      almostComplete: 0,
      inProgress: 0,
      pending: 0
    };
  }

  const stats = {
    total: borrowers.length,
    verified: 0,
    almostComplete: 0,
    inProgress: 0,
    pending: 0
  };

  borrowers.forEach(borrower => {
    const status = getVerificationStatus(borrower);
    switch (status.status) {
      case 'Verified':
        stats.verified++;
        break;
      case 'Almost Complete':
        stats.almostComplete++;
        break;
      case 'In Progress':
        stats.inProgress++;
        break;
      case 'Pending':
        stats.pending++;
        break;
      default:
        stats.pending++;
        break;
    }
  });

  return stats;
};