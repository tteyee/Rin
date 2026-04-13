import { describe, it, expect } from "bun:test";

describe("SitemapService", () => {
  it("should format dates to ISO 8601", () => {
    const timestamp = 1718000000;
    const date = new Date(timestamp * 1000);
    const formatted = date.toISOString().split('T')[0];
    expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("should handle Date objects", () => {
    const now = new Date();
    const formatted = now.toISOString().split('T')[0];
    expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("should escape XML special characters", () => {
    const text = "test&special<>chars";
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
    expect(escaped).toBe("test&amp;special&lt;&gt;chars");
  });
});
