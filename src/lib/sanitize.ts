/**
 * Sanitizes a string for use as a folder name.
 * Removes illegal characters, replaces spaces with underscores, 
 * and trims to a reasonable length.
 */
export function sanitizeFolderName(name: string): string {
  if (!name) return 'unsorted';
  
  return name
    .trim()
    .replace(/[^a-zA-Z0-9_\-\s]/g, '') // Remove everything except alphanumeric, underscores, dashes, and spaces
    .replace(/\s+/g, '_')              // Replace one or more spaces with a single underscore
    .replace(/_+/g, '_')               // Replace one or more underscores with a single underscore
    .replace(/^_+|_+$/g, '')           // Remove leading/trailing underscores
    .substring(0, 100)                 // Limit length
    || 'unsorted';                     // Fallback if empty
}
