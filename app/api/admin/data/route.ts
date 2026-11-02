import { NextResponse } from "next/server";
import { callAdminApi, getAdminSession, listDocuments } from "@/lib/firebase-rest-server";

const activeCompanyIds = new Set(["redcliffe", "practo", "thyrocare"]);

export async function GET() {
  const session = await getAdminSession().catch(() => null);
  if (!session) return NextResponse.json({ error: "Admin session expired. Sign in again." }, { status: 401 });

  const reads = [
    ["companies", async () => (await listDocuments("companies", session.idToken))
      .filter((company: Record<string, unknown>) => activeCompanyIds.has(String(company.id ?? "").toLowerCase()))],
    ["orders", () => listDocuments("orders", session.idToken)],
    ["clients", () => listDocuments("users", session.idToken)],
    ["familyMembers", () => listDocuments("family_members", session.idToken)],
    ["admins", () => listDocuments("admins", session.idToken)],
    ["settlements", () => listDocuments("settlements", session.idToken)],
    ["products", async () => (await listDocuments("products", session.idToken))
      .filter((product: Record<string, unknown>) => activeCompanyIds.has(String(product.companyId ?? product.vendorId ?? "").toLowerCase()))],
    ["ledger", () => listDocuments("credit_ledger", session.idToken, { orderBy: "createdAt", limit: 300 })],
    ["webhookLogs", () => listDocuments("webhook_logs", session.idToken, { orderBy: "timestamp", limit: 250 })],
    ["auditLogs", () => listDocuments("audit_logs", session.idToken, { orderBy: "timestamp", limit: 300 })],
    ["practoBookings", () => listDocuments("Practo_Bookings", session.idToken, { orderBy: "booked_at", limit: 200 })],
    ["practoConsultations", () => callAdminApi("/admin/practo-consultations?limit=100", session.idToken)],
    ["health", () => callAdminApi("/admin/health", session.idToken)],
    ["creditSettings", () => callAdminApi("/admin/settings/credits", session.idToken)],
    ["membershipPlans", () => callAdminApi("/admin/membership-plans", session.idToken)],
    ["membershipHistory", () => callAdminApi("/admin/plan-history?limit=250", session.idToken)],
    ["scheduledNotifications", () => callAdminApi("/admin/notifications/scheduled?limit=100", session.idToken)],
    ["supportTickets", async () => {
      const overview = await callAdminApi("/admin/lucky-ai/overview", session.idToken);
      if (!overview || typeof overview !== "object") return [];
      const tickets = (overview as Record<string, unknown>).supportRequests;
      return Array.isArray(tickets) ? tickets : [];
    }],
  ] as const;

  const data: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  await Promise.all(reads.map(async ([key, read]) => {
    try {
      data[key] = await read();
    } catch (error) {
      data[key] = key === "health" ? null : [];
      errors[key] = error instanceof Error ? error.message : "Could not load this data.";
    }
  }));

  return NextResponse.json({ data, errors, updatedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
