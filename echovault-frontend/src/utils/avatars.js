// Avatar utility functions
export const avatarImages = [
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

/**
 * Get a random avatar image
 * @returns {string} Random avatar filename
 */
export const getRandomAvatar = () => {
  const randomIndex = Math.floor(Math.random() * avatarImages.length);
  const selectedAvatar = avatarImages[randomIndex];
  return selectedAvatar;
};

/**
 * Get avatar URL for a given avatar filename
 * @param {string} avatarFilename - The avatar filename
 * @returns {string} Full URL to the avatar image
 */
export const getAvatarUrl = (avatarFilename) => {
  // Clean the filename - remove any array wrapping or extra data
  let cleanFilename = avatarFilename;
  if (!cleanFilename) {
    cleanFilename = avatarImages[0]; // Default to first avatar
  }
  if (typeof cleanFilename === 'object' && cleanFilename !== null) {
    cleanFilename = cleanFilename.name || cleanFilename.filename || cleanFilename;
  }
  if (Array.isArray(cleanFilename)) {
    cleanFilename = cleanFilename[0];
  }
  cleanFilename = String(cleanFilename).trim();
  
  // If still empty after cleaning, use default
  if (!cleanFilename) {
    cleanFilename = avatarImages[0];
  }
  
  // Use LOCAL avatars from /avatars/ folder in the build directory
  return `/avatars/${cleanFilename}`;
};

/**
 * Get random avatar URL
 * @returns {string} Full URL to a random avatar image
 */
export const getRandomAvatarUrl = () => {
  const randomAvatar = getRandomAvatar();
  const url = getAvatarUrl(randomAvatar);
  return url;
};

/**
 * Get avatar URL for a borrower - uses saved avatar if available, otherwise calculates based on ID
 * @param {number|object} borrowerIdOrBorrower - The borrower ID or borrower object
 * @returns {string} Full URL to the avatar image
 */
export const getAvatarByBorrowerId = (borrowerIdOrBorrower) => {
  let avatarFilename = null;
  
  // If it's an object (borrower), check for saved avatar first
  if (typeof borrowerIdOrBorrower === 'object' && borrowerIdOrBorrower !== null) {
    const borrower = borrowerIdOrBorrower;
    
    // Check for saved avatar in various possible locations
    let savedAvatar = borrower.avatar || 
                       borrower.meta?.avatar || 
                       borrower.fields?.avatar ||
                       (Array.isArray(borrower.avatar) ? borrower.avatar[0] : null) ||
                       (Array.isArray(borrower.meta?.avatar) ? borrower.meta.avatar[0] : null);
    
    // Clean up the avatar value if it's an object
    if (savedAvatar && typeof savedAvatar === 'object') {
      savedAvatar = savedAvatar.name || savedAvatar.filename || savedAvatar.url || savedAvatar;
    }
    
    if (savedAvatar && typeof savedAvatar === 'string' && savedAvatar.trim()) {
      avatarFilename = savedAvatar.trim();
    }
    
    // If no saved avatar, calculate based on borrower ID
    if (!avatarFilename) {
      const borrowerId = borrower.id || borrower.ID;
      if (borrowerId) {
        const avatarIndex = borrowerId % avatarImages.length;
        avatarFilename = avatarImages[avatarIndex];
      }
    }
  } else if (typeof borrowerIdOrBorrower === 'number') {
    // If it's just an ID number, calculate avatar based on ID
    const borrowerId = borrowerIdOrBorrower;
    const avatarIndex = borrowerId % avatarImages.length;
    avatarFilename = avatarImages[avatarIndex];
  }
  
  // Fallback to default avatar if still nothing
  if (!avatarFilename) {
    avatarFilename = avatarImages[0];
  }
  
  // Always return a valid URL - use local /avatars/ folder
  return getAvatarUrl(avatarFilename);
};
