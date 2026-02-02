import { describe, it, expect } from 'vitest';
import { generateSlug, normalizeEstonian } from '../lib/utils/slug';

describe('generateSlug', () => {
  it('should convert basic names to slugs', () => {
    expect(generateSlug('John Smith')).toBe('john-smith');
    expect(generateSlug('Mary Jane Watson')).toBe('mary-jane-watson');
  });

  it('should handle Estonian characters', () => {
    expect(generateSlug('Jüri Rätsepp')).toBe('juri-ratsepp');
    expect(generateSlug('Õnne Pillak')).toBe('onne-pillak');
    expect(generateSlug('Märt Sults')).toBe('mart-sults');
    expect(generateSlug('Heljo Pikhof')).toBe('heljo-pikhof');
    expect(generateSlug('Mihhail Šmuškin')).toBe('mihhail-smuskin');
  });

  it('should handle all Estonian special characters', () => {
    // õ → o
    expect(generateSlug('Õie')).toBe('oie');
    expect(generateSlug('Tõnu')).toBe('tonu');

    // ä → a
    expect(generateSlug('Mägi')).toBe('magi');
    expect(generateSlug('Jänes')).toBe('janes');

    // ö → o
    expect(generateSlug('Öötöö')).toBe('ootoo');

    // ü → u
    expect(generateSlug('Ülle')).toBe('ulle');
    expect(generateSlug('Kütt')).toBe('kutt');

    // š → s
    expect(generateSlug('Šokolad')).toBe('sokolad');

    // ž → z
    expect(generateSlug('Žanr')).toBe('zanr');
  });

  it('should handle uppercase Estonian characters', () => {
    expect(generateSlug('ÕÄÖÜŠŽ')).toBe('oaousz');
  });

  it('should replace multiple non-alphanumeric characters with single hyphen', () => {
    expect(generateSlug('John   Smith')).toBe('john-smith');
    expect(generateSlug('John---Smith')).toBe('john-smith');
    expect(generateSlug('John...Smith')).toBe('john-smith');
  });

  it('should remove leading and trailing hyphens', () => {
    expect(generateSlug('-John Smith-')).toBe('john-smith');
    expect(generateSlug('---John Smith---')).toBe('john-smith');
    expect(generateSlug('  John Smith  ')).toBe('john-smith');
  });

  it('should handle empty input', () => {
    expect(generateSlug('')).toBe('');
  });

  it('should handle special characters', () => {
    expect(generateSlug('Mr. John Smith Jr.')).toBe('mr-john-smith-jr');
    expect(generateSlug("O'Brien")).toBe('o-brien');
  });

  it('should produce consistent results for real MP names', () => {
    // Real Estonian parliament member names
    expect(generateSlug('Kaja Kallas')).toBe('kaja-kallas');
    expect(generateSlug('Jüri Ratas')).toBe('juri-ratas');
    expect(generateSlug('Keit Pentus-Rosimannus')).toBe('keit-pentus-rosimannus');
    expect(generateSlug('Urmas Reinsalu')).toBe('urmas-reinsalu');
    expect(generateSlug('Tõnis Mölder')).toBe('tonis-molder');
  });
});

describe('normalizeEstonian', () => {
  it('should replace Estonian characters without creating slug', () => {
    expect(normalizeEstonian('Jüri Rätsepp')).toBe('Juri Ratsepp');
    // Note: uppercase Estonian chars are replaced with lowercase (current behavior)
    expect(normalizeEstonian('ÕÄÖÜŠŽ')).toBe('oaousz');
  });

  it('should preserve spaces and punctuation', () => {
    expect(normalizeEstonian('Tere, Jüri!')).toBe('Tere, Juri!');
  });

  it('should handle empty input', () => {
    expect(normalizeEstonian('')).toBe('');
  });
});
