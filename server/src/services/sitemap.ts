import { Hono } from "hono";
import { desc, eq, and } from "drizzle-orm";
import type { Variables } from "../core/hono-types";
import { feeds } from "../db/schema";

export function SitemapService(): Hono<{ Bindings: Env; Variables: Variables }> {
    const app = new Hono<{ Bindings: Env; Variables: Variables }>();

    app.get("/", async (c) => {
        const db = c.get("db");
        const host = new URL(c.req.url).origin;

        const rows = await db
            .select({ id: feeds.id, alias: feeds.alias, updatedAt: feeds.updatedAt })
            .from(feeds)
            .where(and(eq(feeds.listed, 1), eq(feeds.draft, 0)))
            .orderBy(desc(feeds.updatedAt))
            .all();

        const urls = (rows as Array<{ id: number; alias: string | null; updatedAt: Date | null }>).map((row) => {
            const loc = row.alias
                ? `${host}/${row.alias}`
                : `${host}/feed/${row.id}`;
            const lastmod = row.updatedAt
                ? new Date(row.updatedAt).toISOString().split("T")[0]
                : new Date().toISOString().split("T")[0];
            return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`;
        });

        const staticUrls = ["/", "/timeline", "/friends", "/hashtags"].map(
            (path) =>
                `  <url>\n    <loc>${host}${path}</loc>\n    <changefreq>daily</changefreq>\n    <priority>${path === "/" ? "1.0" : "0.5"}</priority>\n  </url>`
        );

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrls.join("\n")}
${urls.join("\n")}
</urlset>`;

        return c.text(xml, 200, {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
        });
    });

    return app;
}
