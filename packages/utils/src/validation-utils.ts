/**
 * VALIDATION UTILITIES
 * Helper functions for common validation tasks.
 */

/**
 * Validate Indonesian NIK (National ID Number) format
 */
export function isValidNIK(nik: string): boolean {
  return /^\d{16}$/.test(nik);
}

/**
 * Validate Indonesian NPWP (Tax ID) format
 */
export function isValidNPWP(npwp: string): boolean {
  const cleaned = npwp.replace(/[\s.\-]/g, '');
  return /^\d{15}$/.test(cleaned);
}

/**
 * Validate file type for uploads
 */
export function isAllowedFileType(file: File, allowedTypes: string[]): boolean {
  return allowedTypes.some(type => {
    if (type.endsWith('/*')) {
      return file.type.startsWith(type.slice(0, -1));
    }
    return file.type === type;
  });
}

/**
 * Validate file size
 */
export function isFileSizeValid(file: File, maxSizeBytes: number): boolean {
  return file.size <= maxSizeBytes;
}

/**
 * Check if a value is within a numeric range
 */
export function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

/**
 * Validate date is in the past (for birth dates etc.)
 */
export function isDateInPast(dateString: string): boolean {
  const date = new Date(dateString);
  return !isNaN(date.getTime()) && date < new Date();
}

/**
 * Validate minimum age
 */
export function meetsMinimumAge(dateOfBirth: string, minAge: number): boolean {
  const dob = new Date(dateOfBirth);
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - minAge);
  return dob <= cutoff;
}

/**
 * Check password strength (returns 0-4 score)
 */
export function getPasswordStrength(password: string): number {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  return Math.min(score, 4);
}
