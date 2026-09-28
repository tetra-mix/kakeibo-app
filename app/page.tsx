import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { TodoApp } from "@/components/todo-app";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isPublicFirstUserEnabled } from "@/lib/public-data-settings";
import { getTodosOverview } from "@/server/routes/todos";

// DB(Neon)と同一リージョンに寄せる。既定の iad1 だと getSession などの
// クエリごとに日米間のラウンドトリップが乗る。
export const preferredRegion = "hnd1";

export default async function Home() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session && !isPublicFirstUserEnabled()) {
		redirect("/login");
	}

	// ハイドレーション後に API を叩くと、JS の読み込み → API 呼び出し →
	// セッション再検証 と直列の待ちが乗る。サーバーで取得して初期データとして渡す。
	// JSON を経由させて API のレスポンスと同じ形（日付は文字列）に揃える。
	const initialData = JSON.parse(
		JSON.stringify(await getTodosOverview(db, session?.user ?? null)),
	);

	return <TodoApp isReadOnly={!session} initialData={initialData} />;
}
