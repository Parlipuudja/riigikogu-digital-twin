/**
 * Photo URL extraction and proxy utilities
 */

/**
 * Photo object format from Riigikogu API
 */
export interface RiigikoguhPhotoObject {
  uuid?: string;
  _links?: {
    download?: {
      href?: string;
    };
  };
}

/**
 * Extract URL from various photo formats
 * Handles both string URLs and Riigikogu API photo objects
 *
 * @param photo - String URL or photo object
 * @returns The extracted URL or undefined
 */
export function extractPhotoUrl(photo: unknown): string | undefined {
  if (!photo) return undefined;

  if (typeof photo === "string") {
    return photo;
  }

  if (typeof photo === "object") {
    const photoObj = photo as RiigikoguhPhotoObject;
    return photoObj._links?.download?.href;
  }

  return undefined;
}

/**
 * Get photo proxy URL for a photo
 * Extracts UUID from Riigikogu API URL and returns local proxy path
 *
 * @param photo - String URL or photo object
 * @returns Local proxy URL (/api/photos/{uuid}) or original URL
 */
export function getPhotoProxyUrl(photo: unknown): string | undefined {
  const url = extractPhotoUrl(photo);
  if (!url) return undefined;

  // Extract UUID from Riigikogu API URL and use our proxy
  const match = url.match(/\/files\/([a-f0-9-]{36})\/download/i);
  if (match) {
    return `/api/photos/${match[1]}`;
  }

  // Fallback to original URL
  return url;
}

/**
 * Build direct Riigikogu API photo URL from UUID
 *
 * @param uuid - Photo file UUID
 * @returns Full Riigikogu API URL
 */
export function buildRiigikoguhPhotoUrl(uuid: string): string {
  return `https://api.riigikogu.ee/api/files/${uuid}/download`;
}
