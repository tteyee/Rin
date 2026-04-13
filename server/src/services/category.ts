import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { AppContext } from "../core/hono-types";
import { profileAsync } from "../core/server-timing";
import { categories, feeds } from "../db/schema";
import type { DB } from "../core/hono-types";

// Helper: Convert string to slug
function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function CategoryService(): Hono {
  const app = new Hono();

  // GET /category - List all categories
  app.get("/", async (c: AppContext) => {
    const db = c.get("db");

    const categoryList = await profileAsync(c, "category_list_db", () =>
      db.query.categories.findMany({
        with: {
          feeds: {
            columns: { id: true },
          },
        },
      }),
    );

    const result = categoryList.map((cat: any) => ({
      ...cat,
      count: cat.feeds.length,
    }));

    return c.json(result);
  });

  // GET /category/:name - Get category with feeds
  app.get("/:name", async (c: AppContext) => {
    const db = c.get("db");
    const admin = c.get("admin");
    const nameDecoded = decodeURI(c.req.param("name"));

    const category = await profileAsync(c, "category_detail_db", () =>
      db.query.categories.findFirst({
        where: eq(categories.slug, nameDecoded),
        with: {
          feeds: {
            columns: {
              id: true,
              title: true,
              summary: true,
              content: true,
              createdAt: true,
              updatedAt: true,
              draft: false,
              listed: false,
            },
            with: {
              user: { columns: { id: true, username: true, avatar: true } },
              hashtags: {
                columns: {},
                with: { hashtag: { columns: { id: true, name: true } } },
              },
            },
            where: (f: any) =>
              admin ? undefined : and(eq(f.draft, 0), eq(f.listed, 1)),
          },
        },
      }),
    );

    if (!category) {
      return c.text("Not found", 404);
    }

    const categoryFeeds = category.feeds
      .map((feed: any) => ({
        ...feed,
        hashtags: feed.hashtags.map((h: any) => h.hashtag),
      }))
      .filter((feed: any) => feed !== null);

    return c.json({ ...category, feeds: categoryFeeds });
  });

  // POST /category - Create category (admin only)
  app.post("/", async (c: AppContext) => {
    const db = c.get("db");
    const admin = c.get("admin");
    const uid = c.get("uid");

    if (!admin || !uid) {
      return c.text("Unauthorized", 403);
    }

    const body = await c.req.json();
    const { name, description } = body;

    if (!name || typeof name !== "string") {
      return c.text("Name is required", 400);
    }

    try {
      const slug = slugify(name);
      const result = await db
        .insert(categories)
        .values({
          name,
          slug,
          description: description || null,
          uid,
        })
        .returning();

      if (result.length === 0) {
        return c.text("Failed to create category", 500);
      }

      return c.json(result[0], 201);
    } catch (error: any) {
      console.error("Error creating category:", error);
      if (error.message?.includes("UNIQUE")) {
        return c.text("Category already exists", 409);
      }
      return c.text("Internal Server Error", 500);
    }
  });

  // PUT /category/:id - Update category (admin only)
  app.put("/:id", async (c: AppContext) => {
    const db = c.get("db");
    const admin = c.get("admin");
    const uid = c.get("uid");

    if (!admin || !uid) {
      return c.text("Unauthorized", 403);
    }

    const id = parseInt(c.req.param("id"), 10);
    if (isNaN(id)) {
      return c.text("Invalid ID", 400);
    }

    const body = await c.req.json();
    const { name, description } = body;

    try {
      // Verify ownership
      const category = await db.query.categories.findFirst({
        where: eq(categories.id, id),
      });

      if (!category) {
        return c.text("Category not found", 404);
      }

      if (category.uid !== uid && !admin) {
        return c.text("Unauthorized", 403);
      }

      const updateData: any = {};
      if (name) {
        updateData.name = name;
        updateData.slug = slugify(name);
      }
      if (description !== undefined) {
        updateData.description = description;
      }

      const result = await db
        .update(categories)
        .set(updateData)
        .where(eq(categories.id, id))
        .returning();

      if (result.length === 0) {
        return c.text("Failed to update category", 500);
      }

      return c.json(result[0]);
    } catch (error: any) {
      console.error("Error updating category:", error);
      if (error.message?.includes("UNIQUE")) {
        return c.text("Category name already exists", 409);
      }
      return c.text("Internal Server Error", 500);
    }
  });

  // DELETE /category/:id - Delete category (admin only)
  app.delete("/:id", async (c: AppContext) => {
    const db = c.get("db");
    const admin = c.get("admin");
    const uid = c.get("uid");

    if (!admin || !uid) {
      return c.text("Unauthorized", 403);
    }

    const id = parseInt(c.req.param("id"), 10);
    if (isNaN(id)) {
      return c.text("Invalid ID", 400);
    }

    try {
      // Verify ownership
      const category = await db.query.categories.findFirst({
        where: eq(categories.id, id),
      });

      if (!category) {
        return c.text("Category not found", 404);
      }

      if (category.uid !== uid && !admin) {
        return c.text("Unauthorized", 403);
      }

      // Remove category_id from feeds
      await db.update(feeds).set({ categoryId: null }).where(eq(feeds.categoryId, id));

      // Delete category
      const result = await db
        .delete(categories)
        .where(eq(categories.id, id))
        .returning();

      if (result.length === 0) {
        return c.text("Failed to delete category", 500);
      }

      return c.json({ success: true });
    } catch (error) {
      console.error("Error deleting category:", error);
      return c.text("Internal Server Error", 500);
    }
  });

  return app;
}

// Helper: Get or create category by name
export async function getCategoryIdOrCreate(db: DB, name: string, uid: number) {
  const slug = slugify(name);
  const category = await db.query.categories.findFirst({
    where: eq(categories.name, name),
  });

  if (category) {
    return category.id;
  } else {
    const result = await db
      .insert(categories)
      .values({
        name,
        slug,
        uid,
      })
      .returning({ insertedId: categories.id });

    if (result.length === 0) {
      throw new Error("Failed to insert category");
    }

    return result[0].insertedId;
  }
}
