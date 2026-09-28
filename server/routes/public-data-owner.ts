import { asc } from "drizzle-orm";

import * as schema from "@/db/schema";
import type { auth } from "@/lib/auth";
import type { Database } from "@/lib/db";
import { isPublicFirstUserEnabled } from "@/lib/public-data-settings";
import type { Context } from "@/server/types";

export type SessionUser = typeof auth.$Infer.Session.user;

export type PublicDataOwner = Pick<SessionUser, "id" | "name">;

export async function getReadableDataOwner(c: Context) {
	return await resolveReadableDataOwner(c.get("db"), c.get("user"));
}

// Hono のコンテキスト外（サーバーコンポーネントでの初期データ取得など）からも
// 同じ判定を使えるよう、DB とログインユーザーだけで解決する。
export async function resolveReadableDataOwner(
	db: Database,
	currentUser: SessionUser | null,
) {
	if (currentUser) {
		return {
			user: currentUser,
			isReadOnly: false,
		} as const;
	}

	if (!isPublicFirstUserEnabled()) {
		return {
			user: null,
			isReadOnly: true,
		} as const;
	}

	const [firstUser] = await db
		.select()
		.from(schema.user)
		.orderBy(asc(schema.user.createdAt), asc(schema.user.id))
		.limit(1);

	return {
		user: firstUser ?? null,
		isReadOnly: true,
	} as const;
}

export function toPublicDataOwner(user: SessionUser): PublicDataOwner {
	return {
		id: user.id,
		name: user.name,
	};
}
