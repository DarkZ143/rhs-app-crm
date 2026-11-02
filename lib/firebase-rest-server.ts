import { cookies } from "next/headers";

export const projectId = process.env.FIREBASE_PROJECT_ID || "rhs-app-583c4";
export const firestoreRoot = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
export const functionsBaseUrl = (process.env.RHS_API_BASE_URL || "https://asia-south1-rhs-app-583c4.cloudfunctions.net/api").replace(/\/$/, "");

const idCookie = "rhs_admin_id_token";
const refreshCookie = "rhs_admin_refresh_token";
const uidCookie = "rhs_admin_uid";
const expiryCookie = "rhs_admin_token_expiry";

type FirestoreValue = Record<string, unknown>;

export type AdminSession = {
  uid: string;
  idToken: string;
  profile: Record<string, unknown>;
};

export class AdminApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "AdminApiError";
  }
}

export function decodeFields(fields: Record<string, FirestoreValue> = {}) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]));
}

function decodeValue(value: FirestoreValue): unknown {
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("booleanValue" in value) return value.booleanValue;
  if ("nullValue" in value) return null;
  if ("timestampValue" in value) return value.timestampValue;
  if ("referenceValue" in value) return value.referenceValue;
  if ("bytesValue" in value) return value.bytesValue;
  if ("geoPointValue" in value) return value.geoPointValue;
  if ("arrayValue" in value) {
    const values = (value.arrayValue as { values?: FirestoreValue[] } | undefined)?.values ?? [];
    return values.map(decodeValue);
  }
  if ("mapValue" in value) {
    const fields = (value.mapValue as { fields?: Record<string, FirestoreValue> } | undefined)?.fields;
    return decodeFields(fields);
  }
  return null;
}

function encodeValue(value: unknown): FirestoreValue {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
  if (typeof value === "object" && value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === "object") return { mapValue: { fields: encodeFields(value as Record<string, unknown>) } };
  return { stringValue: String(value) };
}

function encodeFields(fields: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, encodeValue(value)]));
}

export async function readDocument(path: string, idToken: string) {
  const response = await fetch(`${firestoreRoot}/${path.split("/").map(encodeURIComponent).join("/")}`, {
    headers: { Authorization: `Bearer ${idToken}` },
    cache: "no-store",
  });
  if (response.status === 404) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || `Firestore read failed (${response.status}).`);
  const id = String(payload.name || "").split("/").at(-1) || path.split("/").at(-1) || "";
  return { id, ...decodeFields(payload.fields) } as Record<string, unknown>;
}

export async function listDocuments(
  collection: string,
  idToken: string,
  options: { limit?: number; orderBy?: string } = {},
) {
  if (options.orderBy) return queryDocuments(collection, idToken, options.orderBy, options.limit ?? 250);
  const documents: Record<string, unknown>[] = [];
  let pageToken = "";
  do {
    const url = new URL(`${firestoreRoot}/${encodeURIComponent(collection)}`);
    url.searchParams.set("pageSize", "1000");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` }, cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error?.message || `Firestore read failed for ${collection} (${response.status}).`);
    for (const doc of payload.documents ?? []) {
      const id = String(doc.name || "").split("/").at(-1) || "";
      documents.push({ id, ...decodeFields(doc.fields) });
    }
    pageToken = payload.nextPageToken || "";
  } while (pageToken);
  return documents;
}

async function queryDocuments(collection: string, idToken: string, orderBy: string, limit: number) {
  const response = await fetch(`${firestoreRoot}:runQuery`, {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: collection }],
        orderBy: [{ field: { fieldPath: orderBy }, direction: "DESCENDING" }],
        limit,
      },
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || `Firestore query failed for ${collection} (${response.status}).`);
  return (payload ?? []).flatMap((row: { document?: { name?: string; fields?: Record<string, FirestoreValue> } }) => {
    if (!row.document) return [];
    return [{ id: row.document.name?.split("/").at(-1) || "", ...decodeFields(row.document.fields) }];
  });
}

export async function patchDocument(path: string, fields: Record<string, unknown>, idToken: string) {
  const url = new URL(`${firestoreRoot}/${path.split("/").map(encodeURIComponent).join("/")}`);
  for (const key of Object.keys(fields)) url.searchParams.append("updateMask.fieldPaths", key);
  const response = await fetch(url, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ fields: encodeFields(fields) }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || `Firestore update failed (${response.status}).`);
  return payload;
}

export async function createDocument(collection: string, fields: Record<string, unknown>, idToken: string, documentId = crypto.randomUUID()) {
  const url = new URL(`${firestoreRoot}/${encodeURIComponent(collection)}`);
  url.searchParams.set("documentId", documentId);
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ fields: encodeFields(fields) }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || `Firestore create failed (${response.status}).`);
  return payload.name?.split("/").at(-1) || "";
}

function setSessionCookies(store: Awaited<ReturnType<typeof cookies>>, values: {
  idToken: string; refreshToken: string; uid: string; expiresIn: number;
}) {
  const secure = process.env.NODE_ENV === "production";
  const base = { httpOnly: true, sameSite: "lax" as const, secure, path: "/" };
  store.set(idCookie, values.idToken, { ...base, maxAge: values.expiresIn });
  store.set(refreshCookie, values.refreshToken, { ...base, maxAge: 60 * 60 * 24 * 30 });
  store.set(uidCookie, values.uid, { ...base, maxAge: 60 * 60 * 24 * 30 });
  store.set(expiryCookie, String(Date.now() + values.expiresIn * 1000), { ...base, maxAge: values.expiresIn });
}

export function clearSessionCookies(store: Awaited<ReturnType<typeof cookies>>) {
  for (const name of [idCookie, refreshCookie, uidCookie, expiryCookie]) {
    store.set(name, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  }
}

export async function signInWithPassword(email: string, password: string) {
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) throw new Error("FIREBASE_API_KEY is not configured for the admin web app.");
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(authError(payload.error?.message));
  return {
    idToken: String(payload.idToken),
    refreshToken: String(payload.refreshToken),
    uid: String(payload.localId),
    expiresIn: Number(payload.expiresIn || 3600),
    email: String(payload.email || email),
    displayName: String(payload.displayName || ""),
  };
}

function authError(code: string | undefined) {
  return ({
    EMAIL_NOT_FOUND: "No admin account was found for that email.",
    INVALID_PASSWORD: "The password is incorrect.",
    INVALID_LOGIN_CREDENTIALS: "The email or password is incorrect.",
    USER_DISABLED: "This account has been disabled.",
    TOO_MANY_ATTEMPTS_TRY_LATER: "Too many attempts. Try again later.",
  } as Record<string, string>)[code ?? ""] || "Sign in failed. Check your credentials and try again.";
}

export async function loadAdminProfile(uid: string, idToken: string) {
  const profile = await readDocument(`admins/${uid}`, idToken);
  if (!profile || profile.active === false) throw new Error("This account is not an active Restore Health admin.");
  return profile;
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const store = await cookies();
  let idToken = store.get(idCookie)?.value;
  const refreshToken = store.get(refreshCookie)?.value;
  const uid = store.get(uidCookie)?.value;
  const expiresAt = Number(store.get(expiryCookie)?.value ?? 0);
  if (!idToken || !refreshToken || !uid) return null;

  if (expiresAt < Date.now() + 2 * 60 * 1000) {
    const apiKey = process.env.FIREBASE_API_KEY;
    if (!apiKey) return null;
    const response = await fetch(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      cache: "no-store",
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return null;
    idToken = String(payload.id_token);
    const nextRefreshToken = String(payload.refresh_token || refreshToken);
    const expiresIn = Number(payload.expires_in || 3600);
    setSessionCookies(store, { idToken, refreshToken: nextRefreshToken, uid: String(payload.user_id || uid), expiresIn });
  }

  const profile = await loadAdminProfile(uid, idToken);
  return { uid, idToken, profile };
}

export function apiUrl(path: string) {
  return `${functionsBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function callAdminApi(path: string, idToken: string, body?: unknown, method = "GET") {
  const response = await fetch(apiUrl(path), {
    method,
    headers: {
      Authorization: `Bearer ${idToken}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    cache: "no-store",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AdminApiError(
      payload.error?.message || `Admin API request failed (${response.status}).`,
      response.status,
    );
  }
  return payload.data;
}

export function storeSession(session: { idToken: string; refreshToken: string; uid: string; expiresIn: number }) {
  return cookies().then((store) => setSessionCookies(store, session));
}
