import { Hono } from "hono";
import { eq, asc, count } from "drizzle-orm";
import type { AppContext } from "../core/hono-types";
import { categories, feeds } from "../db/schema";

export function CategoryService(): Hono {
    const app = new Hono();

    // GET /category - 카테고리 목록 (공개, 각 카테고리 글 수 포함)
    app.get("/", async (c: AppContext) => {
        const db = c.get("db");
        const list = await db
            .select({
                id: categories.id,
                name: categories.name,
                slug: categories.slug,
                description: categories.description,
                sort_order: categories.sort_order,
            })
            .from(categories)
            .orderBy(asc(categories.sort_order), asc(categories.name));

        // 각 카테고리의 공개 글 수 계산
        const withCounts = await Promise.all(
            list.map(async (cat) => {
                const [row] = await db
                    .select({ cnt: count() })
                    .from(feeds)
                    .where(eq(feeds.category_id, cat.id));
                return { ...cat, feed_count: row?.cnt ?? 0 };
            })
        );

        return c.json(withCounts);
    });

    // POST /category - 카테고리 생성 (관리자)
    app.post("/", async (c: AppContext) => {
        const admin = c.get("admin");
        if (!admin) return c.json({ error: "Unauthorized" }, 401);

        const db = c.get("db");
        const body = await c.req.json<{
            name: string;
            slug: string;
            description?: string;
            sort_order?: number;
        }>();

        if (!body.name?.trim() || !body.slug?.trim()) {
            return c.json({ error: "name and slug are required" }, 400);
        }

        // slug 중복 체크
        const existing = await db.query.categories.findFirst({
            where: eq(categories.slug, body.slug),
        });
        if (existing) {
            return c.json({ error: "slug already exists" }, 409);
        }

        const result = await db
            .insert(categories)
            .values({
                name: body.name.trim(),
                slug: body.slug.trim().toLowerCase(),
                description: body.description?.trim() ?? "",
                sort_order: body.sort_order ?? 0,
            })
            .returning({ id: categories.id });

        return c.json({ id: result[0].id });
    });

    // PUT /category/:id - 카테고리 수정 (관리자)
    app.put("/:id", async (c: AppContext) => {
        const admin = c.get("admin");
        if (!admin) return c.json({ error: "Unauthorized" }, 401);

        const db = c.get("db");
        const id = Number(c.req.param("id"));
        const body = await c.req.json<{
            name?: string;
            slug?: string;
            description?: string;
            sort_order?: number;
        }>();

        const updates: Partial<typeof categories.$inferInsert> = {};
        if (body.name !== undefined) updates.name = body.name.trim();
        if (body.slug !== undefined) updates.slug = body.slug.trim().toLowerCase();
        if (body.description !== undefined) updates.description = body.description.trim();
        if (body.sort_order !== undefined) updates.sort_order = body.sort_order;

        await db.update(categories).set(updates).where(eq(categories.id, id));
        return c.json({ success: true });
    });

    // DELETE /category/:id - 카테고리 삭제 (관리자)
    app.delete("/:id", async (c: AppContext) => {
        const admin = c.get("admin");
        if (!admin) return c.json({ error: "Unauthorized" }, 401);

        const db = c.get("db");
        const id = Number(c.req.param("id"));

        // 해당 카테고리의 글들은 category_id를 null로 변경
        await db
            .update(feeds)
            .set({ category_id: null })
            .where(eq(feeds.category_id, id));

        await db.delete(categories).where(eq(categories.id, id));
        return c.json({ success: true });
    });

    // GET /category/:slug/feeds - 특정 카테고리의 글 목록
    app.get("/:slug/feeds", async (c: AppContext) => {
        const db = c.get("db");
        const slug = c.req.param("slug");

        const cat = await db.query.categories.findFirst({
            where: eq(categories.slug, slug),
        });
        if (!cat) return c.json({ error: "Category not found" }, 404);

        const page = Number(c.req.query("page") ?? 1);
        const limit = Number(c.req.query("limit") ?? 10);
        const offset = (page - 1) * limit;

        const list = await db.query.feeds.findMany({
            where: (f, { and, eq }) =>
                and(eq(f.category_id, cat.id), eq(f.draft, 0), eq(f.listed, 1)),
            orderBy: (f, { desc }) => [desc(f.createdAt)],
            limit,
            offset,
            with: {
                hashtags: { with: { hashtag: true } },
                user: true,
            },
        });

        const [{ total }] = await db
            .select({ total: count() })
            .from(feeds)
            .where(eq(feeds.category_id, cat.id));

        return c.json({ category: cat, feeds: list, total, page, limit });
    });

    return app;
}
