import { AuthError, assertUser } from "@/lib/auth/dal";
import { getSearchIndex } from "@/lib/data";

export async function GET() {
  try {
    const user = await assertUser();
    const items = await getSearchIndex(user.role === "ADMIN");
    return Response.json({ items }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    if (e instanceof AuthError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
