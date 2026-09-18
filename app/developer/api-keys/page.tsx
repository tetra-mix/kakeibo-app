import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ApiKeyManager } from "@/components/api-key-manager";
import { auth } from "@/lib/auth";

// DB(Neon)と同一リージョンに寄せる。既定の iad1 だと getSession などの
// クエリごとに日米間のラウンドトリップが乗る。
export const preferredRegion = "hnd1";

export default async function ApiKeysPage() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session) {
		redirect("/login");
	}

	return <ApiKeyManager />;
}
