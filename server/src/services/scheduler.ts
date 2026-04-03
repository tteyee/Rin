import { and, eq, isNotNull, lte } from "drizzle-orm";
import { feeds } from "../db/schema";

/**
 * 매 5분 Cron 에서 호출.
 * scheduled_at <= 현재시간 이고 draft=1 인 글을 자동 발행.
 */
export async function publishScheduledFeeds(db: any, cache: any) {
    const now = new Date();

    const scheduled = await db
        .select({ id: feeds.id, alias: feeds.alias })
        .from(feeds)
        .where(
            and(
                eq(feeds.draft, 1),
                isNotNull(feeds.scheduled_at),
                lte(feeds.scheduled_at, now),
            )
        );

    if (scheduled.length === 0) return;

    for (const feed of scheduled) {
        await db
            .update(feeds)
            .set({
                draft: 0,
                scheduled_at: null,
                updatedAt: now,
            })
            .where(eq(feeds.id, feed.id));
    }

    // 캐시 무효화
    await cache.deletePrefix("feeds_");
    for (const feed of scheduled) {
        await cache.delete(`feed_${feed.id}`);
        if (feed.alias) await cache.delete(`feed_${feed.alias}`);
    }

    console.log(`[scheduler] ${scheduled.length}개 예약 글 발행 완료`);
}
