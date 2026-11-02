import { NextResponse } from "next/server";
import { callAdminApi, getAdminSession } from "@/lib/firebase-rest-server";

export async function GET(request: Request) {
  const session = await getAdminSession().catch(() => null);
  if (!session) {
    return NextResponse.json(
      { error: "Admin session expired. Sign in again." },
      { status: 401 },
    );
  }

  const clientId = new URL(request.url).searchParams.get("clientId")?.trim() ?? "";
  if (!clientId || clientId.length > 128 || clientId.includes("/")) {
    return NextResponse.json({ error: "A valid client ID is required." }, { status: 400 });
  }

  try {
    const data = await callAdminApi(
      `/admin/users/${encodeURIComponent(clientId)}/practo-consultations`,
      session.idToken,
    );
    return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load this client's Practo details." },
      { status: 502 },
    );
  }
}
