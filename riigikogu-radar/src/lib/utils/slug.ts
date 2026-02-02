/**
 * Slug generation utility with Estonian character handling
 */

/**
 * Estonian character replacements for URL-safe slugs
 */
const ESTONIAN_REPLACEMENTS: Record<string, string> = {
  'õ': 'o',
  'ä': 'a',
  'ö': 'o',
  'ü': 'u',
  'š': 's',
  'ž': 'z',
  'Õ': 'o',
  'Ä': 'a',
  'Ö': 'o',
  'Ü': 'u',
  'Š': 's',
  'Ž': 'z',
};

/**
 * Generate a URL-safe slug from a string with Estonian character support
 *
 * @param input - The string to convert to a slug
 * @returns URL-safe lowercase slug
 *
 * @example
 * generateSlug("Jüri Rätsepp") // "juri-ratsepp"
 * generateSlug("Õnne Pillak") // "onne-pillak"
 */
export function generateSlug(input: string): string {
  if (!input) return '';

  let slug = input.toLowerCase();

  // Replace Estonian characters
  for (const [char, replacement] of Object.entries(ESTONIAN_REPLACEMENTS)) {
    slug = slug.replace(new RegExp(char, 'g'), replacement);
  }

  // Replace non-alphanumeric characters with hyphens
  slug = slug.replace(/[^a-z0-9]+/g, '-');

  // Remove leading/trailing hyphens
  slug = slug.replace(/^-|-$/g, '');

  return slug;
}

/**
 * Normalize Estonian characters without converting to slug
 * Useful for search/comparison
 *
 * @param input - The string to normalize
 * @returns String with Estonian characters replaced
 */
export function normalizeEstonian(input: string): string {
  if (!input) return '';

  let result = input;
  for (const [char, replacement] of Object.entries(ESTONIAN_REPLACEMENTS)) {
    result = result.replace(new RegExp(char, 'g'), replacement);
  }
  return result;
}
