import { Hono } from "hono";
import type { Variables } from "../core/hono-types";

export function AdsService(): Hono<{ Bindings: Env; Variables: Variables }> {
    const app = new Hono<{ Bindings: Env; Variables: Variables }>();

    app.get("/", async (c) => {
        const serverConfig = c.get("serverConfig");
        const adsTxt: string = (await serverConfig.get("ads_txt")) ?? "";

        return c.text(adsTxt, 200, {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
        });
    });

    return app;
}
