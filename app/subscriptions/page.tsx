import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { SubscriptionApp } from "@/components/subscription-app";
import { auth } from "@/lib/auth";
import { isPublicFirstUserEnabled } from "@/lib/public-data-settings";

// DB(Neon)と同一リージョンに寄せる。既定の iad1 だと getSession などの
// クエリごとに日米間のラウンドトリップが乗る。
export const preferredRegion = "hnd1";

export default async function SubscriptionsPage() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session && !isPublicFirstUserEnabled()) {
		redirect("/login");
	}

	return <SubscriptionApp isReadOnly={!session} />;
}
