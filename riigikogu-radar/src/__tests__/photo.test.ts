import { describe, it, expect } from 'vitest';
import { extractPhotoUrl, getPhotoProxyUrl, buildRiigikoguhPhotoUrl } from '../lib/utils/photo';

describe('extractPhotoUrl', () => {
  it('should return undefined for null/undefined input', () => {
    expect(extractPhotoUrl(null)).toBeUndefined();
    expect(extractPhotoUrl(undefined)).toBeUndefined();
  });

  it('should return string URL directly', () => {
    const url = 'https://example.com/photo.jpg';
    expect(extractPhotoUrl(url)).toBe(url);
  });

  it('should extract URL from Riigikogu API photo object', () => {
    const photoObj = {
      _links: {
        download: {
          href: 'https://api.riigikogu.ee/api/files/abc123-uuid/download',
        },
      },
    };
    expect(extractPhotoUrl(photoObj)).toBe('https://api.riigikogu.ee/api/files/abc123-uuid/download');
  });

  it('should return undefined for object without proper structure', () => {
    expect(extractPhotoUrl({})).toBeUndefined();
    expect(extractPhotoUrl({ _links: {} })).toBeUndefined();
    expect(extractPhotoUrl({ _links: { download: {} } })).toBeUndefined();
  });

  it('should handle object with uuid but no download link', () => {
    const photoObj = {
      uuid: 'abc123',
    };
    expect(extractPhotoUrl(photoObj)).toBeUndefined();
  });
});

describe('getPhotoProxyUrl', () => {
  it('should return undefined for null/undefined input', () => {
    expect(getPhotoProxyUrl(null)).toBeUndefined();
    expect(getPhotoProxyUrl(undefined)).toBeUndefined();
  });

  it('should convert Riigikogu API URL to proxy URL', () => {
    const url = 'https://api.riigikogu.ee/api/files/a1b2c3d4-e5f6-7890-abcd-ef1234567890/download';
    expect(getPhotoProxyUrl(url)).toBe('/api/photos/a1b2c3d4-e5f6-7890-abcd-ef1234567890');
  });

  it('should handle photo object with Riigikogu URL', () => {
    const photoObj = {
      _links: {
        download: {
          href: 'https://api.riigikogu.ee/api/files/a1b2c3d4-e5f6-7890-abcd-ef1234567890/download',
        },
      },
    };
    expect(getPhotoProxyUrl(photoObj)).toBe('/api/photos/a1b2c3d4-e5f6-7890-abcd-ef1234567890');
  });

  it('should return original URL for non-Riigikogu URLs', () => {
    const url = 'https://example.com/photo.jpg';
    expect(getPhotoProxyUrl(url)).toBe(url);
  });

  it('should handle case-insensitive UUID matching', () => {
    const url = 'https://api.riigikogu.ee/api/files/A1B2C3D4-E5F6-7890-ABCD-EF1234567890/download';
    expect(getPhotoProxyUrl(url)).toBe('/api/photos/A1B2C3D4-E5F6-7890-ABCD-EF1234567890');
  });
});

describe('buildRiigikoguhPhotoUrl', () => {
  it('should build correct URL from UUID', () => {
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    expect(buildRiigikoguhPhotoUrl(uuid)).toBe(
      'https://api.riigikogu.ee/api/files/a1b2c3d4-e5f6-7890-abcd-ef1234567890/download'
    );
  });
});
