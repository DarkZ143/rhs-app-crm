import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clearSessionCookies, getAdminSession, loadAdminProfile, signInWithPassword, storeSession } from "@/lib/firebase-rest-server";

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Admin session expired. Sign in again." }, { status: 401 });
    return NextResponse.json({
      admin: {
        uid: session.uid,
        name: session.profile.name || session.profile.displayName || session.profile.email || "Admin",
        email: session.profile.email || "",
        role: session.profile.role || "super_admin",
        active: session.profile.active !== false,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    clearSessionCookies(await cookies());
    return NextResponse.json({ error: error instanceof Error ? error.message : "Admin session could not be verified." }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || "").trim();
    const password = String(body.password || "");
    if (!email || !password) return NextResponse.json({ error: "Enter your admin email and password." }, { status: 400 });

    const session = await signInWithPassword(email, password);
    const profile = await loadAdminProfile(session.uid, session.idToken);
    await storeSession(session);
    return NextResponse.json({
      admin: {
        uid: session.uid,
        name: profile.name || session.displayName || profile.email || session.email,
        email: profile.email || session.email,
        role: profile.role || "super_admin",
        active: profile.active !== false,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sign in failed.";
    return NextResponse.json({ error: message }, { status: message.includes("admin") ? 403 : 401 });
  }
}

export async function DELETE() {
  clearSessionCookies(await cookies());
  return NextResponse.json({ ok: true });
}
