import { describe, it, expect } from "bun:test";
import { validateSitemap } from "../sitemap-validator";

describe("Sitemap Validator", () => {
  it("should validate correct sitemap index", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://example.com/sitemap-posts-1.xml</loc>
    <lastmod>2026-04-13</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://example.com/sitemap-tags-1.xml</loc>
    <lastmod>2026-04-13</lastmod>
  </sitemap>
</sitemapindex>`;

    const result = validateSitemap(xml);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it("should validate correct urlset", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>https://example.com/article/test</loc>
    <lastmod>2026-04-13</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`;

    const result = validateSitemap(xml);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it("should detect missing XML declaration", () => {
    const xml = `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/article/test</loc>
  </url>
</urlset>`;

    const result = validateSitemap(xml);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("XML declaration"))).toBe(true);
  });

  it("should detect invalid URL in loc", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>not-a-valid-url</loc>
  </url>
</urlset>`;

    const result = validateSitemap(xml);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Invalid URL"))).toBe(true);
  });

  it("should detect invalid lastmod format", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/article/test</loc>
    <lastmod>2026/04/13</lastmod>
  </url>
</urlset>`;

    const result = validateSitemap(xml);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Invalid lastmod format"))).toBe(true);
  });

  it("should detect invalid changefreq", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/article/test</loc>
    <changefreq>invalid</changefreq>
  </url>
</urlset>`;

    const result = validateSitemap(xml);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Invalid changefreq"))).toBe(true);
  });

  it("should detect invalid priority", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/article/test</loc>
    <priority>1.5</priority>
  </url>
</urlset>`;

    const result = validateSitemap(xml);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Invalid priority"))).toBe(true);
  });

  it("should detect unescaped XML characters", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/article/test&special</loc>
  </url>
</urlset>`;

    const result = validateSitemap(xml);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Unescaped ampersand"))).toBe(true);
  });

  it("should validate escaped XML characters", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/article/test&amp;special</loc>
  </url>
</urlset>`;

    const result = validateSitemap(xml);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it("should detect mismatched XML tags", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/article/test</loc>
  </url>
</urlset`;

    const result = validateSitemap(xml);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Mismatched XML tags"))).toBe(true);
  });

  it("should warn about empty urlset", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>`;

    const result = validateSitemap(xml);
    expect(result.warnings.some((w) => w.includes("No <url> entries"))).toBe(true);
  });
});
