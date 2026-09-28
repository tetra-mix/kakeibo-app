import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import * as schema from "@/db/schema";
import { db } from "@/lib/db";

export const auth = betterAuth({
	baseURL: process.env.BETTER_AUTH_URL,
	database: drizzleAdapter(db, {
		provider: "pg",
		schema,
	}),
	session: {
		expiresIn: 60 * 60 * 24 * 30,
		updateAge: 60 * 60 * 24,
		// getSession はページ描画と API 呼び出しのたびに走るため、署名付き Cookie に
		// セッションをキャッシュして DB への往復を省く。失効の反映は最大 maxAge 遅れる。
		cookieCache: {
			enabled: true,
			maxAge: 5 * 60,
		},
	},
	emailAndPassword: {
		enabled: true,
	},
});
