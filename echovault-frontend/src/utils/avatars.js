// Avatar utility functions
export const avatarImages = [
  'monster.svg',
  'monster-1.svg',
  'monster-2.svg',
  'monster-3.svg',
  'monster-4.svg',
  'monster-5.svg',
  'monster-6.svg',
  'monster-7.svg',
  'monster-8.svg',
  'monster-9.svg',
  'monster-10.svg',
  'monster-11.svg',
  'monster-12.svg'
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
  if (!avatarFilename) {
    return null;
  }
  const url = `https://echovault.space/wp-content/uploads/2025/10/${avatarFilename}`;
  return url;
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
 * Get consistent avatar URL based on borrower ID
 * @param {number} borrowerId - The borrower ID
 * @returns {string} Full URL to the avatar image
 */
export const getAvatarByBorrowerId = (borrowerId) => {
  if (!borrowerId) {
    return null;
  }
  
  // Use modulo to get a consistent avatar based on borrower ID
  const avatarIndex = borrowerId % avatarImages.length;
  const avatarFilename = avatarImages[avatarIndex];
  const url = getAvatarUrl(avatarFilename);
  
  return url;
};
