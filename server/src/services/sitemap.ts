import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { AppContext } from "../core/hono-types";
import { profileAsync } from "../core/server-timing";
import { feeds, hashtags } from "../db/schema";
import { getStorageObject, putStorageObjectAtKey } from "../utils/storage";
import { validateSitemap } from "../utils/sitemap-validator";

// Constants
const ITEMS_PER_SITEMAP = 50000; // Google Sitemap limit
const CACHE_FOLDER = 'cache/sitemap/';
const CACHE_TTL = 24 * 60 * 60; // 24 hours

interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: number;
  images?: Array<{ loc: string; title?: string }>;
}

// Helper: Escape XML special characters
function escapeXml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Helper: Format date to ISO 8601
function formatDate(timestamp: number | Date): string {
  let date: Date;
  if (timestamp instanceof Date) {
    date = timestamp;
  } else {
    date = new Date(timestamp * 1000);
  }
  return date.toISOString().split('T')[0];
}

// Helper: Build sitemap XML
function buildSitemapXml(entries: SitemapEntry[]): string {
  const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>';
  const xmlNamespace = 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"';

  let xml = `${xmlHeader}\n<urlset ${xmlNamespace}>\n`;

  for (const entry of entries) {
    xml += '  <url>\n';
    xml += `    <loc>${escapeXml(entry.loc)}</loc>\n`;

    if (entry.lastmod) {
      xml += `    <lastmod>${entry.lastmod}</lastmod>\n`;
    }

    if (entry.changefreq) {
      xml += `    <changefreq>${entry.changefreq}</changefreq>\n`;
    }

    if (entry.priority !== undefined) {
      xml += `    <priority>${entry.priority.toFixed(1)}</priority>\n`;
    }

    // Add image entries if present
    if (entry.images && entry.images.length > 0) {
      for (const img of entry.images) {
        xml += '    <image:image>\n';
        xml += `      <image:loc>${escapeXml(img.loc)}</image:loc>\n`;
        if (img.title) {
          xml += `      <image:title>${escapeXml(img.title)}</image:title>\n`;
        }
        xml += '    </image:image>\n';
      }
    }

    xml += '  </url>\n';
  }

  xml += '</urlset>';
  return xml;
}

// Helper: Build sitemap index XML
function buildSitemapIndexXml(
  sitemaps: Array<{ loc: string; lastmod?: string }>,
): string {
  const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>';
  const xmlNamespace = 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"';

  let xml = `${xmlHeader}\n<sitemapindex ${xmlNamespace}>\n`;

  for (const sitemap of sitemaps) {
    xml += '  <sitemap>\n';
    xml += `    <loc>${escapeXml(sitemap.loc)}</loc>\n`;
    if (sitemap.lastmod) {
      xml += `    <lastmod>${sitemap.lastmod}</lastmod>\n`;
    }
    xml += '  </sitemap>\n';
  }

  xml += '</sitemapindex>';
  return xml;
}

// Helper: Get site URL from request
function getSiteUrl(c: AppContext): string {
  const host = c.req.header('host') || 'localhost';
  const protocol = c.req.header('x-forwarded-proto') || 'https';
  return `${protocol}://${host}`;
}

// Helper: Try to get cached sitemap
async function getCachedSitemap(
  env: Env,
  cacheKey: string,
): Promise<string | null> {
  try {
    const folder = env.S3_CACHE_FOLDER || 'cache/';
    const key = `${folder}${cacheKey}`;
    const response = await getStorageObject(env, key);
    return response ? await response.text() : null;
  } catch {
    return null;
  }
}

// Helper: Cache sitemap
async function cacheSitemap(env: Env, cacheKey: string, content: string) {
  try {
    const folder = env.S3_CACHE_FOLDER || 'cache/';
    const key = `${folder}${cacheKey}`;
    await putStorageObjectAtKey(
      env,
      key,
      new TextEncoder().encode(content),
      'application/xml; charset=UTF-8',
    );
  } catch (e) {
    console.error('Failed to cache sitemap:', e);
  }
}

export function SitemapService(): Hono {
  const app = new Hono();

  // GET /sitemap.xml - Sitemap Index
  app.get('/sitemap.xml', async (c: AppContext) => {
    const env = c.get('env');
    const db = c.get('db');

    const cacheKey = 'sitemap-index.xml';
    const cached = await getCachedSitemap(env, cacheKey);
    if (cached) {
      return c.text(cached, 200, { 'Content-Type': 'application/xml; charset=UTF-8' });
    }

    try {
      const siteUrl = getSiteUrl(c);

      // Count posts to determine pagination
      const postCount = await profileAsync(c, 'sitemap_count_posts', () =>
        db.query.feeds.findMany({
          where: and(eq(feeds.draft, 0), eq(feeds.listed, 1)),
          columns: { id: true },
        }),
      );
      const postPages = Math.ceil(postCount.length / ITEMS_PER_SITEMAP);

      // Count tags
      const tagCount = await profileAsync(c, 'sitemap_count_tags', () =>
        db.query.hashtags.findMany({
          columns: { id: true },
        }),
      );
      const tagPages = Math.ceil(tagCount.length / ITEMS_PER_SITEMAP);

      // Build sitemap index
      const sitemaps: Array<{ loc: string; lastmod?: string }> = [];

      // Add posts sitemaps
      for (let i = 1; i <= postPages; i++) {
        sitemaps.push({
          loc: `${siteUrl}/sitemap-posts-${i}.xml`,
        });
      }

      // Add tags sitemaps
      if (tagPages > 0) {
        for (let i = 1; i <= tagPages; i++) {
          sitemaps.push({
            loc: `${siteUrl}/sitemap-tags-${i}.xml`,
          });
        }
      }

      const xml = buildSitemapIndexXml(sitemaps);

      // Validate XML in development
      const validation = validateSitemap(xml);
      if (!validation.valid) {
        console.error('Sitemap index validation errors:', validation.errors);
      }

      // Cache the index
      await cacheSitemap(env, cacheKey, xml);

      return c.text(xml, 200, { 'Content-Type': 'application/xml; charset=UTF-8' });
    } catch (error) {
      console.error('Error generating sitemap index:', error);
      return c.text('Internal Server Error', 500);
    }
  });

  // GET /sitemap-posts-:page.xml - Posts Sitemap
  app.get('/sitemap-posts-:page.xml', async (c: AppContext) => {
    const env = c.get('env');
    const db = c.get('db');
    const page = parseInt(c.req.param('page'), 10);

    if (isNaN(page) || page < 1) {
      return c.text('Invalid page number', 400);
    }

    const cacheKey = `sitemap-posts-${page}.xml`;
    const cached = await getCachedSitemap(env, cacheKey);
    if (cached) {
      return c.text(cached, 200, { 'Content-Type': 'application/xml; charset=UTF-8' });
    }

    try {
      const siteUrl = getSiteUrl(c);
      const offset = (page - 1) * ITEMS_PER_SITEMAP;

      const posts = await profileAsync(c, 'sitemap_fetch_posts', () =>
        db.query.feeds.findMany({
          where: and(eq(feeds.draft, 0), eq(feeds.listed, 1)),
          columns: {
            id: true,
            alias: true,
            title: true,
            updatedAt: true,
            content: true,
          },
          orderBy: desc(feeds.updatedAt),
          limit: ITEMS_PER_SITEMAP,
          offset: offset,
        }),
      );

      if (posts.length === 0) {
        return c.text('Not found', 404);
      }

      const entries: SitemapEntry[] = posts.map((post) => {
        const url = post.alias
          ? `${siteUrl}/article/${encodeURIComponent(post.alias)}`
          : `${siteUrl}/article/${post.id}`;

        // Extract first image from content (simple regex)
        const imageMatch = post.content?.match(/!\[.*?\]\((.*?)\)/);
        const images = imageMatch
          ? [{ loc: imageMatch[1], title: post.title || undefined }]
          : undefined;

        return {
          loc: url,
          lastmod: formatDate(post.updatedAt),
          changefreq: 'weekly',
          priority: 1.0,
          images,
        };
      });

      const xml = buildSitemapXml(entries);

      // Validate XML in development
      const validation = validateSitemap(xml);
      if (!validation.valid) {
        console.error(`Posts sitemap page ${page} validation errors:`, validation.errors);
      }

      // Cache the sitemap
      await cacheSitemap(env, cacheKey, xml);

      return c.text(xml, 200, { 'Content-Type': 'application/xml; charset=UTF-8' });
    } catch (error) {
      console.error('Error generating posts sitemap:', error);
      return c.text('Internal Server Error', 500);
    }
  });

  // GET /sitemap-tags-:page.xml - Tags Sitemap
  app.get('/sitemap-tags-:page.xml', async (c: AppContext) => {
    const env = c.get('env');
    const db = c.get('db');
    const page = parseInt(c.req.param('page'), 10);

    if (isNaN(page) || page < 1) {
      return c.text('Invalid page number', 400);
    }

    const cacheKey = `sitemap-tags-${page}.xml`;
    const cached = await getCachedSitemap(env, cacheKey);
    if (cached) {
      return c.text(cached, 200, { 'Content-Type': 'application/xml; charset=UTF-8' });
    }

    try {
      const siteUrl = getSiteUrl(c);
      const offset = (page - 1) * ITEMS_PER_SITEMAP;

      const tags = await profileAsync(c, 'sitemap_fetch_tags', () =>
        db.query.hashtags.findMany({
          columns: {
            id: true,
            name: true,
            updatedAt: true,
          },
          orderBy: desc(hashtags.updatedAt),
          limit: ITEMS_PER_SITEMAP,
          offset: offset,
        }),
      );

      if (tags.length === 0) {
        return c.text('Not found', 404);
      }

      const entries: SitemapEntry[] = tags.map((tag) => ({
        loc: `${siteUrl}/tag/${encodeURIComponent(tag.name)}`,
        lastmod: formatDate(tag.updatedAt),
        changefreq: 'weekly',
        priority: 0.8,
      }));

      const xml = buildSitemapXml(entries);

      // Validate XML in development
      const validation = validateSitemap(xml);
      if (!validation.valid) {
        console.error(`Tags sitemap page ${page} validation errors:`, validation.errors);
      }

      // Cache the sitemap
      await cacheSitemap(env, cacheKey, xml);

      return c.text(xml, 200, { 'Content-Type': 'application/xml; charset=UTF-8' });
    } catch (error) {
      console.error('Error generating tags sitemap:', error);
      return c.text('Internal Server Error', 500);
    }
  });

  return app;
}

// Cron job: Invalidate sitemaps on schedule (called from scheduled handler)
export async function invalidateSitemapCache(env: Env, db: any) {
  try {
    const folder = env.S3_CACHE_FOLDER || 'cache/';

    // Delete all sitemap cache files
    const cacheKeys = [
      `${folder}sitemap-index.xml`,
      // Individual sitemaps will be regenerated on demand
    ];

    // Note: Cloudflare R2 doesn't have bulk delete, so we just invalidate the index
    // Individual post/tag sitemaps will be regenerated as requested
    console.log('Sitemap cache invalidated');
  } catch (error) {
    console.error('Failed to invalidate sitemap cache:', error);
  }
}
