/**
 * Phone number utilities for normalization and comparison
 * Handles Israeli phone number formats
 */

/**
 * Normalizes a phone number for comparison
 * Removes spaces, dashes, parentheses, and handles Israeli format
 * @param {string} phoneNumber - The phone number to normalize
 * @returns {string} - Normalized phone number (digits only)
 */
export function normalizePhoneNumber(phoneNumber) {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return '';
  }

  // Remove all non-digit characters
  let normalized = phoneNumber.replace(/\D/g, '');

  // Handle Israeli international prefix
  // +972 5X XXX XXXX -> 05XXXXXXXX
  if (normalized.startsWith('972')) {
    normalized = '0' + normalized.substring(3);
  }

  // Handle cases where leading zero is missing
  // 5XXXXXXXX -> 05XXXXXXXX
  if (normalized.length === 9 && normalized.startsWith('5')) {
    normalized = '0' + normalized;
  }

  return normalized;
}

/**
 * Checks if two phone numbers are the same after normalization
 * @param {string} phone1 - First phone number
 * @param {string} phone2 - Second phone number
 * @returns {boolean} - True if phones match
 */
export function arePhoneNumbersEqual(phone1, phone2) {
  const normalized1 = normalizePhoneNumber(phone1);
  const normalized2 = normalizePhoneNumber(phone2);
  
  return normalized1 !== '' && normalized1 === normalized2;
}

/**
 * Formats a phone number for display (Israeli format)
 * @param {string} phoneNumber - The phone number to format
 * @returns {string} - Formatted phone number
 */
export function formatPhoneNumber(phoneNumber) {
  const normalized = normalizePhoneNumber(phoneNumber);
  
  // Israeli mobile format: 05X-XXX-XXXX
  if (normalized.length === 10 && normalized.startsWith('05')) {
    return `${normalized.substring(0, 3)}-${normalized.substring(3, 6)}-${normalized.substring(6)}`;
  }
  
  // Return original if doesn't match expected format
  return phoneNumber;
}
