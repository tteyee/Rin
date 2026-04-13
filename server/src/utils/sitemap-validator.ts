/**
 * Sitemap XML Validator
 * Validates that generated sitemaps conform to Google's sitemap protocol
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// XML validation regex patterns
const XML_HEADER_PATTERN = /^<\?xml version="1\.0" encoding="UTF-8"\?>/;
const URLSET_PATTERN = /<urlset[^>]*>/;
const URL_PATTERN = /<url>(.*?)<\/url>/gs;
const LOC_PATTERN = /<loc>(.*?)<\/loc>/;
const LASTMOD_PATTERN = /<lastmod>(.*?)<\/lastmod>/;
const CHANGEFREQ_PATTERN = /<changefreq>(.*?)<\/changefreq>/;
const PRIORITY_PATTERN = /<priority>(.*?)<\/priority>/;
const SITEMAPINDEX_PATTERN = /<sitemapindex[^>]*>/;
const SITEMAP_PATTERN = /<sitemap>(.*?)<\/sitemap>/gs;

const VALID_CHANGEFREQ = ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'];

function validateUrl(url: string): string[] {
  const errors: string[] = [];

  if (!url) {
    errors.push('URL is empty');
    return errors;
  }

  if (url.length > 2048) {
    errors.push(`URL exceeds 2048 characters: ${url.length}`);
  }

  try {
    new URL(url);
  } catch {
    errors.push(`Invalid URL format: ${url}`);
  }

  // Check for unescaped special characters
  if (url.includes('&') && !url.includes('&amp;')) {
    errors.push(`Unescaped ampersand in URL: ${url}`);
  }
  if (url.includes('<') || url.includes('>')) {
    errors.push(`Unescaped angle brackets in URL: ${url}`);
  }

  return errors;
}

function validateLastmod(lastmod: string): string[] {
  const errors: string[] = [];

  // Should be in YYYY-MM-DD or ISO 8601 format
  if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}Z?)?$/.test(lastmod)) {
    errors.push(`Invalid lastmod format (should be YYYY-MM-DD): ${lastmod}`);
  }

  return errors;
}

function validateChangefreq(changefreq: string): string[] {
  const errors: string[] = [];

  if (!VALID_CHANGEFREQ.includes(changefreq.toLowerCase())) {
    errors.push(`Invalid changefreq: ${changefreq}. Must be one of: ${VALID_CHANGEFREQ.join(', ')}`);
  }

  return errors;
}

function validatePriority(priority: string): string[] {
  const errors: string[] = [];

  const num = parseFloat(priority);
  if (isNaN(num) || num < 0.0 || num > 1.0) {
    errors.push(`Invalid priority: ${priority}. Must be between 0.0 and 1.0`);
  }

  return errors;
}

function validateUrlEntry(entryXml: string): string[] {
  const errors: string[] = [];

  // Extract and validate loc
  const locMatch = entryXml.match(LOC_PATTERN);
  if (!locMatch || !locMatch[1]) {
    errors.push('Missing or empty <loc> tag');
  } else {
    errors.push(...validateUrl(locMatch[1]));
  }

  // Optional: validate lastmod if present
  const lastmodMatch = entryXml.match(LASTMOD_PATTERN);
  if (lastmodMatch && lastmodMatch[1]) {
    errors.push(...validateLastmod(lastmodMatch[1]));
  }

  // Optional: validate changefreq if present
  const changefreqMatch = entryXml.match(CHANGEFREQ_PATTERN);
  if (changefreqMatch && changefreqMatch[1]) {
    errors.push(...validateChangefreq(changefreqMatch[1]));
  }

  // Optional: validate priority if present
  const priorityMatch = entryXml.match(PRIORITY_PATTERN);
  if (priorityMatch && priorityMatch[1]) {
    errors.push(...validatePriority(priorityMatch[1]));
  }

  return errors;
}

export function validateSitemap(xml: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check XML declaration
  if (!XML_HEADER_PATTERN.test(xml.trim())) {
    errors.push('Missing or invalid XML declaration');
  }

  // Check for sitemapindex vs urlset
  const isSitemapIndex = SITEMAPINDEX_PATTERN.test(xml);
  const isUrlset = URLSET_PATTERN.test(xml);

  if (!isSitemapIndex && !isUrlset) {
    errors.push('Missing <urlset> or <sitemapindex> root element');
  }

  // Validate sitemapindex entries
  if (isSitemapIndex) {
    const sitemapMatches = xml.matchAll(SITEMAP_PATTERN);
    let count = 0;

    for (const match of sitemapMatches) {
      count++;
      const sitemapXml = match[1];

      // Each sitemap entry should have a loc
      const locMatch = sitemapXml.match(LOC_PATTERN);
      if (!locMatch || !locMatch[1]) {
        errors.push(`Sitemap entry ${count}: Missing <loc> tag`);
      } else {
        errors.push(...validateUrl(locMatch[1]).map((e) => `Sitemap entry ${count}: ${e}`));
      }

      // Optional: validate lastmod
      const lastmodMatch = sitemapXml.match(LASTMOD_PATTERN);
      if (lastmodMatch && lastmodMatch[1]) {
        errors.push(
          ...validateLastmod(lastmodMatch[1]).map((e) => `Sitemap entry ${count}: ${e}`),
        );
      }
    }

    if (count === 0) {
      warnings.push('No <sitemap> entries found in sitemapindex');
    }
  }

  // Validate urlset entries
  if (isUrlset) {
    const urlMatches = xml.matchAll(URL_PATTERN);
    let count = 0;

    for (const match of urlMatches) {
      count++;
      const urlXml = match[1];
      errors.push(...validateUrlEntry(urlXml).map((e) => `URL entry ${count}: ${e}`));
    }

    if (count === 0) {
      warnings.push('No <url> entries found in urlset');
    }

    // Check max URL count (50000 per sitemap spec)
    if (count > 50000) {
      errors.push(`Too many URLs (${count}). Maximum is 50000 per sitemap.`);
    }
  }

  // Check for well-formedness (basic check)
  const openTags = (xml.match(/<[^/>]+>/g) || []).length;
  const closeTags = (xml.match(/<\/[^>]+>/g) || []).length;
  if (openTags !== closeTags) {
    errors.push('Mismatched XML tags (open and close tags do not match)');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
