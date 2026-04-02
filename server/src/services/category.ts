import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { Variables } from "../core/hono-types";
import { categories, feeds } from "../db/schema";

export function CategoryService(): Hono<{ Bindings: Env; Variables: Variables }> {
    const app = new Hono<{ Bindings: Env; Variables: Variables }>();

    // GET / - 카테고리 전체 목록
    app.get("/", async (c) => {
        const db = c.get("db");
        const rows = await db.select().from(categories).all();
        return c.json(rows);
    });

    // GET /:id - 카테고리 단일 조회
    app.get("/:id", async (c) => {
        const db = c.get("db");
        const id = Number(c.req.param("id"));
        if (isNaN(id)) return c.text("Invalid id", 400);

        const row = await db.query.categories.findFirst({
            where: eq(categories.id, id),
        });
        if (!row) return c.text("Not found", 404);
        return c.json(row);
    });

    // GET /:id/feeds - 카테고리에 속한 글 목록
    app.get("/:id/feeds", async (c) => {
        const db = c.get("db");
        const id = Number(c.req.param("id"));
        if (isNaN(id)) return c.text("Invalid id", 400);

        const rows = await db
            .select({ id: feeds.id, title: feeds.title, alias: feeds.alias, createdAt: feeds.createdAt })
            .from(feeds)
            .where(eq(feeds.category_id, id))
            .all();

        return c.json({ data: rows, size: rows.length });
    });

    // POST / - 카테고리 생성 (관리자)
    app.post("/", async (c) => {
        const admin = c.get("admin");
        if (!admin) return c.text("Permission denied", 403);

        const db = c.get("db");
        const body = await c.req.json<{ name: string; slug: string; description?: string }>();

        if (!body.name || !body.slug) return c.text("name and slug are required", 400);

        const result = await db.insert(categories).values({
            name: body.name,
            slug: body.slug,
            description: body.description ?? null,
        }).returning({ id: categories.id });

        return c.json({ id: result[0].id });
    });

    // POST /:id - 카테고리 수정 (관리자)
    app.post("/:id", async (c) => {
        const admin = c.get("admin");
        if (!admin) return c.text("Permission denied", 403);

        const db = c.get("db");
        const id = Number(c.req.param("id"));
        if (isNaN(id)) return c.text("Invalid id", 400);

        const body = await c.req.json<{ name?: string; slug?: string; description?: string }>();

        await db.update(categories).set({
            ...(body.name !== undefined && { name: body.name }),
            ...(body.slug !== undefined && { slug: body.slug }),
            ...(body.description !== undefined && { description: body.description }),
        }).where(eq(categories.id, id));

        return c.json({ ok: true });
    });

    // POST /feed/:feedId/assign - 글에 카테고리 배정 (관리자)
    app.post("/feed/:feedId/assign", async (c) => {
        const admin = c.get("admin");
        if (!admin) return c.text("Permission denied", 403);

        const db = c.get("db");
        const feedId = Number(c.req.param("feedId"));
        if (isNaN(feedId)) return c.text("Invalid feedId", 400);

        const body = await c.req.json<{ category_id: number | null }>();

        await db.update(feeds)
            .set({ category_id: body.category_id })
            .where(eq(feeds.id, feedId));

        return c.json({ ok: true });
    });

    // DELETE /:id - 카테고리 삭제 (관리자)
    app.delete("/:id", async (c) => {
        const admin = c.get("admin");
        if (!admin) return c.text("Permission denied", 403);

        const db = c.get("db");
        const id = Number(c.req.param("id"));
        if (isNaN(id)) return c.text("Invalid id", 400);

        // 해당 카테고리 글들은 category_id = null로 (schema에서 onDelete: 'set null')
        await db.delete(categories).where(eq(categories.id, id));

        return c.json({ ok: true });
    });

    return app;
}
