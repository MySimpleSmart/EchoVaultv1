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
    return { status: 'Pending', color: 'red', percentage: 0, missingFields: [] };
  }

  // Field configuration with display names
  const fieldConfig = [
    { key: 'first_name', label: 'First Name', category: 'Basic Info' },
    { key: 'last_name', label: 'Last Name', category: 'Basic Info' },
    { key: 'email_address', label: 'Email Address', category: 'Basic Info' },
    { key: 'date_of_birth', label: 'Date of Birth', category: 'Basic Info' },
    { key: 'mobile_number', label: 'Mobile Number', category: 'Basic Info' },
    { key: 'registration_number', label: 'Registration Number', category: 'Basic Info' },
    { key: 'home_address', label: 'Home Address', category: 'Basic Info' },
    { key: 'document_type', label: 'Document Type', category: 'Basic Info' },
    
    { key: 'social_link_1', label: 'Social Link 1', category: 'Social' },
    // social_link_2 is optional
    
    { key: 'employment_status', label: 'Employment Status', category: 'Employment' },
    { key: 'work_rights', label: 'Work Rights', category: 'Employment' },
    { key: 'employer_name', label: 'Employer Name', category: 'Employment' },
    { key: 'job_title', label: 'Job Title', category: 'Employment' },
    { key: 'monthly_income_aud', label: 'Monthly Income', category: 'Employment' },
    { key: 'employment_start_date', label: 'Employment Start Date', category: 'Employment' },
    { key: 'employer_phone', label: 'Employer Phone', category: 'Employment' },
    { key: 'employer_email', label: 'Employer Email', category: 'Employment' },
    { key: 'employer_address', label: 'Employer Address', category: 'Employment' },
    
    { key: 'marital_status', label: 'Marital Status', category: 'Family' },
    { key: 'family_relationship', label: 'Family Relationship', category: 'Family' },
    { key: 'family_member_full_name', label: 'Family Member Name', category: 'Family' },
    { key: 'family_member_phone', label: 'Family Member Phone', category: 'Family' },
    { key: 'family_member_email', label: 'Family Member Email', category: 'Family' },
    
    { key: 'bank_name', label: 'Bank Name', category: 'Banking' },
    { key: 'account_name', label: 'Account Name', category: 'Banking' },
    { key: 'bsb_number', label: 'BSB Number', category: 'Banking' },
    { key: 'account_number', label: 'Account Number', category: 'Banking' },
    
    { key: 'visa_type', label: 'Visa Type', category: 'Visa Status' },
    { key: 'visa_expiry_date', label: 'Visa Expiry Date', category: 'Visa Status' }
  ];

  // Check each field and track missing ones
  let completedFields = 0;
  let totalFields = 0;
  const missingFields = [];

  fieldConfig.forEach(field => {
    const value = borrower[field.key];
    totalFields++; // Always increment total fields
    
    // Special handling for email field
    if (field.key === 'email_address') {
      if (isValidEmailFormat(value)) {
        completedFields++;
      } else {
        missingFields.push(field);
      }
    }
    // Regular field check
    else if (hasContent(value)) {
      completedFields++;
    } else {
      missingFields.push(field);
    }
  });

  // Calculate percentage
  const percentage = totalFields > 0 ? Math.round((completedFields / totalFields) * 100) : 0;

  // Return status based on completion
  if (percentage === 100) {
    return { status: 'Verified', color: 'green', percentage, missingFields: [] };
  } else if (percentage >= 75) {
    return { status: 'Almost Complete', color: 'blue', percentage, missingFields };
  } else if (percentage >= 50) {
    return { status: 'In Progress', color: 'yellow', percentage, missingFields };
  } else {
    return { status: 'Pending', color: 'red', percentage, missingFields };
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