import { Hono } from "hono";
import { desc, eq, and } from "drizzle-orm";
import type { AppContext } from "../core/hono-types";
import { feeds } from "../db/schema";

/**
 * StaticFilesService
 * - GET /ads.txt        → ads.txt 내용 (DB config에서 가져옴)
 * - GET /sitemap.xml    → 동적 sitemap 생성
 * - GET /robots.txt     → robots.txt 서빙
 */
export function StaticFilesService(): Hono {
    const app = new Hono();

    // GET /ads.txt
    app.get("/ads.txt", async (c: AppContext) => {
        const clientConfig = c.get("clientConfig");
        const adsTxt = await clientConfig.get("custom.ads_txt");
        const content = typeof adsTxt === "string" && adsTxt.trim()
            ? adsTxt
            : "# No ads.txt configured";
        return c.text(content, 200, {
            "Content-Type": "text/plain; charset=UTF-8",
            "Cache-Control": "public, max-age=86400",
        });
    });

    // GET /sitemap.xml
    app.get("/sitemap.xml", async (c: AppContext) => {
        const db = c.get("db");
        const url = new URL(c.req.url);
        const baseUrl = `${url.protocol}//${url.host}`;

        // 공개된 글 목록 가져오기
        const feedList = await db
            .select({
                id: feeds.id,
                alias: feeds.alias,
                updatedAt: feeds.updatedAt,
                createdAt: feeds.createdAt,
            })
            .from(feeds)
            .where(and(eq(feeds.draft, 0), eq(feeds.listed, 1)))
            .orderBy(desc(feeds.updatedAt))
            .limit(1000);

        const staticPages = [
            { loc: `${baseUrl}/`, priority: "1.0", changefreq: "daily" },
            { loc: `${baseUrl}/timeline`, priority: "0.8", changefreq: "daily" },
            { loc: `${baseUrl}/hashtags`, priority: "0.7", changefreq: "weekly" },
            { loc: `${baseUrl}/friends`, priority: "0.6", changefreq: "monthly" },
            { loc: `${baseUrl}/about`, priority: "0.6", changefreq: "monthly" },
        ];

        const feedEntries = feedList.map((feed) => {
            const slug = feed.alias || String(feed.id);
            const lastmod = new Date(feed.updatedAt).toISOString().split("T")[0];
            return `  <url>
    <loc>${baseUrl}/feed/${slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`;
        });

        const staticEntries = staticPages.map((page) => {
            return `  <url>
    <loc>${page.loc}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`;
        });

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticEntries.join("\n")}
${feedEntries.join("\n")}
</urlset>`;

        return c.text(xml, 200, {
            "Content-Type": "application/xml; charset=UTF-8",
            "Cache-Control": "public, max-age=3600",
        });
    });

    return app;
}
