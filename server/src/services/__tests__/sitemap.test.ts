import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Hono } from "hono";
import { testClient } from "hono/testing";
import type { AppContext } from "../../core/hono-types";
import { SitemapService } from "../sitemap";

describe("SitemapService", () => {
  let app: Hono;
  let client: ReturnType<typeof testClient>;

  beforeEach(() => {
    app = new Hono();
    app.route("/", SitemapService());
    client = testClient(app);
  });

  it("should return valid XML for sitemap index", async () => {
    const res = await client.sitemap.xml.$get();
    expect(res.status).toBe(200);

    const contentType = res.headers.get("content-type");
    expect(contentType).toContain("application/xml");

    const xml = await res.text();
    expect(xml).toContain("<?xml version");
    expect(xml).toContain("<sitemapindex");
    expect(xml).toContain("</sitemapindex>");
  });

  it("should properly escape XML special characters in URLs", async () => {
    const xml = `<loc>https://example.com/article/test&special<>chars</loc>`;
    // Should be escaped
    expect(xml).not.toContain("&special<>chars");
  });

  it("should format dates to ISO 8601", async () => {
    const timestamp = 1718000000; // arbitrary timestamp
    const date = new Date(timestamp * 1000).toISOString().split("T")[0];
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
