import { handle } from "hono/vercel";

import { app } from "@/server/hono-app";
export const runtime = "nodejs";
// DB(Neon)と同一リージョンに寄せる。既定の iad1 だと 1 クエリごとに
// 日米間のラウンドトリップが乗り、API 応答が数秒単位で悪化する。
export const preferredRegion = "hnd1";

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
export const PATCH = handle(app);
