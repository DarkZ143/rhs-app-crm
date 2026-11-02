import { NextResponse } from "next/server";
import { AdminApiError, callAdminApi, getAdminSession } from "@/lib/firebase-rest-server";

export async function GET(request: Request) {
  const session = await getAdminSession().catch(() => null);
  if (!session) return NextResponse.json({ error: "Admin session expired. Sign in again." }, { status: 401 });
  const query = new URL(request.url).searchParams;
  const params = new URLSearchParams({ vendorId: query.get("vendorId") || "" });
  const specialityId = query.get("specialityId");
  if (specialityId) params.set("specialityId", specialityId);
  const offset = query.get("offset");
  if (offset && /^\d+$/.test(offset)) params.set("offset", offset);
  try {
    const data = await callAdminApi(`/admin/catalog-pricing?${params.toString()}`, session.idToken);
    return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const upstreamMessage = error instanceof Error ? error.message : "Could not load provider pricing.";
    const upstreamStatus = error instanceof AdminApiError ? error.status : 502;
    const routeMissing = upstreamStatus === 404 && upstreamMessage === "Route not found.";
    const message = routeMissing
      ? "The catalog-pricing API is not deployed to Cloud Functions yet. Deploy the latest functions, then reload this page."
      : upstreamMessage;
    console.error("admin.catalog_pricing_upstream_failed", {
      vendorId: query.get("vendorId") || "",
      status: upstreamStatus,
      message: routeMissing ? "catalog-pricing route missing" : upstreamMessage,
    });
    return NextResponse.json({ error: message }, { status: upstreamStatus });
  }
}
