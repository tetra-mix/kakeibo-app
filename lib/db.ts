import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
	throw new Error("DATABASE_URL is not set");
}

// Vercel のサーバーレス環境では実行ごとにインスタンスが凍結・破棄されるため、
// 接続確立のコストがリクエスト単位で乗る。プールを最小限に保ちつつ、
// アイドル接続を早めに解放してコネクション枯渇を避ける。
const isServerless = Boolean(process.env.VERCEL);

const client = postgres(connectionString, {
	prepare: false,
	max: isServerless ? 1 : 10,
	idle_timeout: isServerless ? 20 : undefined,
	connect_timeout: 10,
});

export const db = drizzle(client, { schema });
export type Database = PostgresJsDatabase<typeof schema>;
