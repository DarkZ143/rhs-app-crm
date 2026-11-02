"use client";

import Image from "next/image";
import ClientPractoHistory from "./client-practo-history";
import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

type Row = Record<string, unknown> & { id: string };
type Admin = { uid: string; name: string; email: string; role: string; active: boolean };
type Section = "overview" | "providers" | "orders" | "clients" | "phoneLogin" | "consultations" | "support" | "finance" | "catalog" | "integrations" | "activity" | "admins" | "reports" | "plans";
type Wallet = "practo" | "redcliffe" | "thyrocare";
type NotificationTarget = "all" | "user" | "users" | "active_plan" | "no_active_plan";
type NotificationTiming = "now" | "scheduled";
type DialogState =
  | { kind: "credit"; client: Row; wallet: Wallet }
  | { kind: "newClient" }
  | { kind: "partner" }
  | { kind: "manualOrder" }
  | { kind: "orderStatus"; order: Row }
  | { kind: "refund"; order: Row }
  | { kind: "clientStatus"; booking: Row }
  | { kind: "phoneLogin"; client: Row }
  | null;
type AdminData = {
  companies: Row[]; orders: Row[]; clients: Row[]; admins: Row[]; settlements: Row[];
  products: Row[]; ledger: Row[]; webhookLogs: Row[]; auditLogs: Row[]; practoBookings: Row[]; familyMembers: Row[];
  practoConsultations: { items?: Row[]; nextCursor?: string | null } | null;
  health: { mode?: string; vendors?: Row[] } | null;
  creditSettings: { practoConsultFeeRupees?: number } | null;
  membershipPlans: Row[];
  membershipHistory: Row[];
  scheduledNotifications: Row[];
  supportTickets: Row[];
  errors: Record<string, string>;
};

const blankData: AdminData = {
  companies: [], orders: [], clients: [], admins: [], settlements: [], products: [],
  ledger: [], webhookLogs: [], auditLogs: [], practoBookings: [], familyMembers: [],
  practoConsultations: null, health: null, creditSettings: null, membershipPlans: [], membershipHistory: [], scheduledNotifications: [], supportTickets: [], errors: {},
};
const navigation: { id: Section; label: string; symbol: string; group: string }[] = [
  { id: "plans", label: "Plans & notifications", symbol: "R+", group: "Settings" },
  { id: "phoneLogin", label: "Phone OTP access", symbol: "OTP", group: "Workspace" },
  { id: "overview", label: "Command center", symbol: "▦", group: "Workspace" },
  { id: "orders", label: "Orders & bookings", symbol: "▤", group: "Workspace" },
  { id: "clients", label: "Clients & wallets", symbol: "♙", group: "Workspace" },
  { id: "consultations", label: "Practo consultations", symbol: "✚", group: "Workspace" },
  { id: "support", label: "Support tickets", symbol: "✉", group: "Workspace" },
  { id: "providers", label: "Providers", symbol: "⌘", group: "Operations" },
  { id: "catalog", label: "Product catalog", symbol: "▧", group: "Operations" },
  { id: "integrations", label: "Integrations & health", symbol: "◉", group: "Operations" },
  { id: "finance", label: "Finance & settlements", symbol: "₹", group: "Finance" },
  { id: "activity", label: "Logs & audit", symbol: "☷", group: "Finance" },
  { id: "admins", label: "Admin access", symbol: "♧", group: "Settings" },
  { id: "reports", label: "Reports & exports", symbol: "▥", group: "Settings" },
];
const walletOptions: { id: Wallet; label: string; shortLabel: string; key: string; color: string; icon: string }[] = [
  { id: "practo", label: "Practo RHS Credit", shortLabel: "Practo", key: "practoRhsCoins", color: "blue", icon: "✚" },
  { id: "redcliffe", label: "Redcliffe RHS Credit", shortLabel: "Redcliffe", key: "redcliffeRhsCoins", color: "violet", icon: "◈" },
  { id: "thyrocare", label: "Thyrocare RHS Credit", shortLabel: "Thyrocare", key: "thyrocareRhsCoins", color: "green", icon: "⌬" },
];

const scoreOptions = [
  { key: "staySecureScore", label: "Stay Secure", icon: "⛨" },
  { key: "healthScore", label: "Health Score", icon: "♥" },
];

const staySecureTasks = [
  { id: "redcliffe_cbc", label: "Redcliffe · Complete Blood Count (CBC)" },
  { id: "redcliffe_thyroid", label: "Redcliffe · Thyroid Profile" },
  { id: "redcliffe_hba1c", label: "Redcliffe · HbA1c" },
  { id: "thyrocare_thyroid", label: "Thyrocare · Thyroid Profile" },
  { id: "thyrocare_hba1c", label: "Thyrocare · HbA1c" },
  { id: "thyrocare_lipid", label: "Thyrocare · Lipid Profile" },
  { id: "thyrocare_vitamins", label: "Thyrocare · Vitamins Profile" },
  { id: "practo_general_physician", label: "Practo · General Physician consultation" },
  { id: "practo_dermatology", label: "Practo · Dermatology consultation" },
  { id: "practo_cardiology", label: "Practo · Cardiology consultation" },
];

function StaySecureTaskAdmin({
  client,
  canMutate,
  busy,
  runAction,
}: {
  client: Row;
  canMutate: boolean;
  busy: boolean;
  runAction: (action: string, values?: Record<string, unknown>, message?: string) => Promise<unknown>;
}) {
  const completed = Array.isArray(client.staySecureCompletedTaskIds)
    ? client.staySecureCompletedTaskIds.filter((id): id is string => typeof id === "string")
    : [];
  const setCompleted = (taskId: string, checked: boolean) => {
    const next = new Set(completed);
    if (checked) next.add(taskId);
    else next.delete(taskId);
    const completedTaskIds = staySecureTasks.filter((task) => next.has(task.id)).map((task) => task.id);
    void runAction("setStaySecureTasks", { userId: client.id, completedTaskIds }, "Tracker completion updated.").catch(() => undefined);
  };
  return <div className="drawer-section">
    <div className="section-heading compact-heading"><div><h3>Stay Secure tracker</h3><p>{completed.length} of 10 activities complete. Set score separately above.</p></div></div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "4px 16px" }}>
      {staySecureTasks.map((task) => <label key={task.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 2px", color: "var(--ink)", fontSize: 13 }}>
        <input type="checkbox" checked={completed.includes(task.id)} disabled={!canMutate || busy}
          onChange={(event) => setCompleted(task.id, event.target.checked)} />
        <span>{task.label}</span>
      </label>)}
    </div>
  </div>;
}

function FamilyMemberReviewPanel({
  client,
  requests,
  canMutate,
  busy,
  onReview,
}: {
  client: Row;
  requests: Row[];
  canMutate: boolean;
  busy: boolean;
  onReview: (memberId: string, status: "APPROVED" | "REJECTED") => void;
}) {
  const clientName = text(client, "name", "displayName") || "RHS client";
  const pending = requests.filter((request) => (text(request, "status") || "PENDING").toUpperCase() === "PENDING");
  const sortedRequests = requests.slice().sort((a, b) => dateValue(b.createdAt) - dateValue(a.createdAt));

  return <section className="drawer-section family-review-section">
    <div className="section-heading compact-heading">
      <div>
        <h3>Family member approvals</h3>
        <p>{pending.length ? `${pending.length} request${pending.length === 1 ? "" : "s"} waiting for review.` : "Review requests submitted by this client."}</p>
      </div>
      {pending.length > 0 && <span className="family-pending-badge">{pending.length} pending</span>}
    </div>
    {requests.length === 0 ? <div className="family-review-empty">This client has not added any family members.</div> : <>
      <div className="family-request-owner"><small>Requested by this client</small><strong>{clientName}</strong><span>{text(client, "phone", "phoneNumber", "email") || client.id}</span></div>
      <div className="family-request-list">
        {sortedRequests.map((request) => {
          const memberId = request.id;
          const memberName = text(request, "name") || "Family member";
          const status = (text(request, "status") || "PENDING").toUpperCase();
          return <article className="family-request-card" key={memberId}>
            <div className="family-request-topline">
              <div><strong>{memberName}</strong><small>{[text(request, "relation"), text(request, "age") ? `${text(request, "age")} yrs` : "", text(request, "gender")].filter(Boolean).join(" · ") || "Details not provided"}</small></div>
              <Status value={status} enabled={status === "APPROVED" ? true : status === "REJECTED" ? false : undefined} />
            </div>
            <div className="family-request-meta"><span>Requested {dateText(request.createdAt)}</span>{text(request, "reviewedByName") && <span>Reviewed by {text(request, "reviewedByName")}</span>}</div>
            {text(request, "reviewNote") && <p className="family-request-note">Review note: {text(request, "reviewNote")}</p>}
            {status === "PENDING" && canMutate && <div className="family-request-actions">
              <button className="button button-primary button-small" disabled={busy} onClick={() => onReview(memberId, "APPROVED")}>Approve member</button>
              <button className="button button-danger-soft button-small" disabled={busy} onClick={() => {
                if (window.confirm(`Reject ${memberName}'s family member request from ${clientName}?`)) onReview(memberId, "REJECTED");
              }}>Reject</button>
            </div>}
          </article>;
        })}
      </div>
    </>}
  </section>;
}

function ExactScoreEditor({
  value,
  busy,
  canMutate,
  onSave,
}: {
  value: number;
  busy: boolean;
  canMutate: boolean;
  onSave: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return <form onSubmit={(event) => {
    event.preventDefault();
    const next = Number(draft);
    if (!Number.isInteger(next) || next < 0 || next > 100 || next === value) return;
    onSave(next);
  }} style={{ display: "flex", alignItems: "center", gap: 5 }}>
    <input aria-label="Set score percentage" type="number" min={0} max={100} value={draft}
      onChange={(event) => setDraft(event.target.value)} disabled={!canMutate || busy}
      style={{ width: 58, padding: "6px 5px", border: "1px solid var(--line)", borderRadius: 8, textAlign: "center" }} />
    <button className="button button-small button-soft" type="submit" disabled={!canMutate || busy}>Set %</button>
  </form>;
}

function rows(value: unknown): Row[] {
  return Array.isArray(value) ? value.filter((item): item is Row => !!item && typeof item === "object" && "id" in item) : [];
}
function text(row: Row | null | undefined, ...keys: string[]) {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value);
  }
  return "";
}
function number(row: Row | null | undefined, ...keys: string[]) {
  for (const key of keys) {
    const value = row?.[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return 0;
}
function flag(row: Row, key: string, fallback = false) {
  const value = row[key];
  return typeof value === "boolean" ? value : fallback;
}
function phoneLoginRecord(row: Row): Record<string, unknown> {
  const value = row.phoneLogin;
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function phoneLoginStatus(row: Row) {
  const status = String(phoneLoginRecord(row).status ?? "NOT_APPROVED").toUpperCase();
  return ["APPROVED", "NOT_APPROVED", "DISABLED"].includes(status) ? status : "NOT_APPROVED";
}
function inr(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}
function inrExact(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}
function coins(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}
function dateText(value: unknown) {
  if (!value) return "—";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}
function initials(value: string) {
  return value.trim().split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "R";
}
function labelStatus(value: string) {
  return value.replaceAll("_", " ").replaceAll("-", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Unknown";
}
function orderPhone(row: Row) {
  const raw = text(row, "customerPhone", "phone").replace(/\D/g, "");
  return raw.length > 10 ? raw.slice(-10) : raw;
}
function formObject(form: HTMLFormElement) {
  return Object.fromEntries(new FormData(form).entries());
}
function localDateTimeInput(value: Date) {
  return new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
function localDateInput(value: Date) {
  return localDateTimeInput(value).slice(0, 10);
}

export default function AdminConsole() {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [data, setData] = useState<AdminData>(blankData);
  const [dataLoading, setDataLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");
  const [section, setSection] = useState<Section>("overview");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientIdLookup, setClientIdLookup] = useState("");
  const [activityTab, setActivityTab] = useState<"audit" | "api" | "wallet">("audit");
  const [consultations, setConsultations] = useState<Row[]>([]);
  const [supportDrafts, setSupportDrafts] = useState<Record<string, string>>({});
  const [pricingVendor, setPricingVendor] = useState("redcliffe");
  const [pricingSpeciality, setPricingSpeciality] = useState("22");
  const [pricingOffset, setPricingOffset] = useState(0);
  const [pricingItems, setPricingItems] = useState<Row[]>([]);
  const [pricingSpecialities, setPricingSpecialities] = useState<Row[]>([]);
  const [pricingTotal, setPricingTotal] = useState(0);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingError, setPricingError] = useState("");
  const [pricingRefresh, setPricingRefresh] = useState(0);
  const [redcliffeWebhookResult, setRedcliffeWebhookResult] = useState<{ endpoint: string; verified: boolean } | null>(null);
  const [editingMembershipPlan, setEditingMembershipPlan] = useState<Row | null>(null);
  const [planAssignmentClientId, setPlanAssignmentClientId] = useState("");
  const [planAssignmentTemplateId, setPlanAssignmentTemplateId] = useState("");
  const [planAssignmentStartDate, setPlanAssignmentStartDate] = useState("");
  const [planAssignmentValidityDays, setPlanAssignmentValidityDays] = useState("365");
  const [planPaymentAmount, setPlanPaymentAmount] = useState("");
  const [notificationTarget, setNotificationTarget] = useState<NotificationTarget>("all");
  const [notificationUserIds, setNotificationUserIds] = useState<string[]>([]);
  const [notificationSingleUserId, setNotificationSingleUserId] = useState("");
  const [notificationClientSearch, setNotificationClientSearch] = useState("");
  const [notificationType, setNotificationType] = useState("announcement");
  const [notificationPriority, setNotificationPriority] = useState("normal");
  const [notificationPushEnabled, setNotificationPushEnabled] = useState(true);
  const [notificationTitle, setNotificationTitle] = useState("");
  const [notificationBody, setNotificationBody] = useState("");
  const [notificationActionRoute, setNotificationActionRoute] = useState("");
  const [notificationActionLabel, setNotificationActionLabel] = useState("");
  const [notificationTiming, setNotificationTiming] = useState<NotificationTiming>("now");
  const [notificationScheduledAt, setNotificationScheduledAt] = useState("");
  const [notificationScheduleMin, setNotificationScheduleMin] = useState("");
  const [todayISO, setTodayISO] = useState("");
  const dataRequestGeneration = useRef(0);

  useEffect(() => {
    const now = new Date();
    const today = localDateInput(now);
    setTodayISO(today);
    setPlanAssignmentStartDate((current) => current || today);
    setNotificationScheduledAt((current) => current || localDateTimeInput(new Date(now.getTime() + 5 * 60_000)));
    setNotificationScheduleMin(localDateTimeInput(new Date(now.getTime() + 60_000)));
  }, []);

  const loadData = useCallback(async (quiet = false) => {
    const generation = ++dataRequestGeneration.current;
    if (!quiet) setDataLoading(true);
    try {
      const response = await fetch("/api/admin/data", { cache: "no-store" });
      const payload = await response.json();
      if (generation !== dataRequestGeneration.current) return;
      if (response.status === 401) {
        setAdmin(null);
        throw new Error(payload.error || "Admin session expired. Sign in again.");
      }
      if (!response.ok) throw new Error(payload.error || "Could not load admin data.");
      const received = payload.data || {};
      setData({
        companies: rows(received.companies), orders: rows(received.orders), clients: rows(received.clients),
        admins: rows(received.admins), settlements: rows(received.settlements), products: rows(received.products),
        ledger: rows(received.ledger), webhookLogs: rows(received.webhookLogs), auditLogs: rows(received.auditLogs),
        practoBookings: rows(received.practoBookings), familyMembers: rows(received.familyMembers),
        practoConsultations: received.practoConsultations && typeof received.practoConsultations === "object" ? received.practoConsultations : null,
        health: received.health && typeof received.health === "object" ? received.health : null,
        creditSettings: received.creditSettings && typeof received.creditSettings === "object" ? received.creditSettings : null,
        membershipPlans: rows(received.membershipPlans?.items),
        membershipHistory: rows(received.membershipHistory?.items),
        scheduledNotifications: rows(received.scheduledNotifications?.items),
        supportTickets: rows(received.supportTickets),
        errors: payload.errors || {},
      });
      setConsultations(rows(received.practoConsultations?.items));
      setLastUpdated(payload.updatedAt || new Date().toISOString());
      setError("");
    } catch (reason) {
      if (generation === dataRequestGeneration.current) {
        setError(reason instanceof Error ? reason.message : "Could not load admin data.");
      }
    } finally {
      if (generation === dataRequestGeneration.current) setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/session", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (response.ok && active) setAdmin(payload.admin);
      })
      .catch(() => undefined)
      .finally(() => { if (active) setSessionLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!admin) return;
    void loadData();
    const interval = window.setInterval(() => void loadData(true), 20_000);
    const onVisible = () => { if (document.visibilityState === "visible") void loadData(true); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  }, [admin, loadData]);

  useEffect(() => {
    if (!admin || section !== "catalog") return;
    let active = true;
    setPricingLoading(true);
    setPricingError("");
    const params = new URLSearchParams({ vendorId: pricingVendor });
    if (pricingVendor === "practo") params.set("specialityId", pricingSpeciality);
    if (pricingVendor === "practo") params.set("offset", String(pricingOffset));
    fetch(`/api/admin/catalog-pricing?${params.toString()}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Could not load provider pricing.");
        const received = payload.data || {};
        if (!active) return;
        setPricingItems(rows(received.items));
        setPricingSpecialities(rows(received.specialities));
        setPricingTotal(Number(received.total) || 0);
      })
      .catch((reason) => {
        if (active) {
          setPricingItems([]);
          setPricingError(reason instanceof Error ? reason.message : "Could not load provider pricing.");
        }
      })
      .finally(() => { if (active) setPricingLoading(false); });
    return () => { active = false; };
  }, [admin, section, pricingVendor, pricingSpeciality, pricingOffset, pricingRefresh]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 3600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const canMutate = admin?.role !== "read_only";
  const canFinance = admin?.role === "super_admin" || admin?.role === "finance_admin";
  const canManageLogins = ["super_admin", "operations_admin", "support_admin", "admin"].includes(String(admin?.role || "").toLowerCase());
  const canDeleteClients = String(admin?.role || "").toLowerCase() === "super_admin";
  const activeLabel = navigation.find((item) => item.id === section)?.label || "Command center";
  const selectedClient = data.clients.find((client) => client.id === selectedClientId) || null;
  const pendingFamilyRequestCount = data.familyMembers.filter((request) => (text(request, "status") || "PENDING").toUpperCase() === "PENDING").length;
  const selectedClientFamilyRequests = selectedClient
    ? data.familyMembers.filter((request) => text(request, "userId") === selectedClient.id)
    : [];
  const query = search.trim().toLowerCase();
  const filteredClients = useMemo(() => data.clients.filter((row) => !query || [row.id, row.name, row.displayName, row.email, row.phone].some((value) => String(value ?? "").toLowerCase().includes(query))), [data.clients, query]);
  const filteredPhoneClients = useMemo(() => data.clients.filter((row) => !query || [row.id, row.name, row.displayName, row.email, row.phone, row.phoneNumber, phoneLoginRecord(row).phoneNumber, phoneLoginRecord(row).status].some((value) => String(value ?? "").toLowerCase().includes(query))), [data.clients, query]);

  const totals = useMemo(() => {
    const wallets = walletOptions.map((wallet) => data.clients.reduce((sum, client) => sum + number(client, wallet.key), 0));
    const grossPaise = data.orders.reduce((sum, order) => sum + number(order, "amountPaise"), 0);
    const commissionPaise = data.orders.reduce((sum, order) => sum + number(order, "commissionPaise"), 0);
    const pendingOrders = data.orders.filter((order) => ["NEW", "PENDING", "PLACED", "CONFIRMED", "IN_PROGRESS"].includes(text(order, "orderStatus").toUpperCase())).length;
    const failedOrders = data.orders.filter((order) => text(order, "orderStatus", "partnerStatus").toUpperCase().includes("FAILED") || !!order.errorNotice).length;
    return { wallets, totalWallet: wallets.reduce((sum, amount) => sum + amount, 0), grossPaise, commissionPaise, pendingOrders, failedOrders };
  }, [data.clients, data.orders]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginBusy(true); setError("");
    try {
      const form = formObject(event.currentTarget);
      const response = await fetch("/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Sign in failed.");
      setAdmin(payload.admin);
      setSearch("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sign in failed.");
    } finally {
      setLoginBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/session", { method: "DELETE" }).catch(() => undefined);
    setAdmin(null); setData(blankData); setSelectedClientId(""); setSection("overview");
    setEditingMembershipPlan(null); setPlanAssignmentClientId(""); setPlanAssignmentTemplateId("");
    setNotificationUserIds([]); setNotificationTarget("all"); setNotificationTitle(""); setNotificationBody("");
  }

  async function runAction(action: string, values: Record<string, unknown> = {}, successMessage = "Changes saved.") {
    setBusy(true); setError("");
    let confirmedCredit: { userId: string; walletKey: string; balance: number } | null = null;
    try {
      const response = await fetch("/api/admin/action", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...values }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "The action failed.");
      const createdClientId = action === "createClient" && payload.data && typeof payload.data === "object"
        ? String((payload.data as Record<string, unknown>).uid || "")
        : "";
      if (action === "addCredits" && payload.data && typeof payload.data === "object") {
        const result = payload.data as Record<string, unknown>;
        const wallet = String(result.walletType || "") as Wallet;
        const walletKey = walletOptions.find((option) => option.id === wallet)?.key;
        const userId = String(result.userId || "");
        const balance = Number(result.balance);
        if (walletKey && userId && Number.isFinite(balance)) {
          confirmedCredit = { userId, walletKey, balance };
        }
      }
      setDialog(null); setNotice(successMessage);
      await loadData(true);
      if (createdClientId) {
        setSearch("");
        setSelectedClientId(createdClientId);
      }
      if (confirmedCredit) {
        const { userId, walletKey, balance } = confirmedCredit;
        setData((current) => ({
          ...current,
          clients: current.clients.map((client) => client.id === userId
            ? { ...client, [walletKey]: balance }
            : client),
        }));
      }
      return payload.data;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The action failed.");
      throw reason;
    } finally {
      setBusy(false);
    }
  }

  function openClientById(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const uid = clientIdLookup.trim();
    if (!uid) return;
    const client = data.clients.find((row) => row.id === uid);
    if (!client) {
      setError("No client profile matches that ID.");
      return;
    }
    setError("");
    setSelectedClientId(client.id);
  }

  function deleteClient(client: Row) {
    if (!canDeleteClients || busy) return;
    const displayName = text(client, "name", "displayName") || "this client";
    const remainingCredit = walletOptions.reduce((sum, wallet) => sum + number(client, wallet.key), 0);
    if (!window.confirm(`Permanently delete ${displayName} and their client-owned data? This also removes ${inr(remainingCredit)} remaining RHS credit. Orders and wallet history will be retained.`)) return;
    const typedId = window.prompt(`Type the client ID to confirm deletion:\n${client.id}`);
    if (typedId?.trim() !== client.id) {
      if (typedId !== null) setError("Client ID did not match. Nothing was deleted.");
      return;
    }
    setSelectedClientId("");
    void runAction("deleteClient", { userId: client.id }, "Client and client-owned data deleted. Order and wallet history retained.").catch(() => undefined);
  }

  if (sessionLoading) return <div className="startup-screen"><div className="loader" /><span>Connecting to Restore Health admin…</span></div>;

  if (!admin) {
    return <main className="login-layout">
      <section className="login-brand">
        <Image src="/logo.png" alt="Restore Health Services" width={76} height={76} priority />
        <span className="eyebrow">RESTORE HEALTH SERVICES</span>
        <h1>One console for every patient and partner.</h1>
        <p>Manage live bookings, clients, provider wallets, integrations, and settlements.</p>
        <div className="login-proof"><span className="live-dot" /> Live data from the RHS admin backend</div>
      </section>
      <section className="login-panel">
        <div className="login-form-wrap">
          <span className="eyebrow">ADMIN ACCESS</span>
          <h2>Welcome back</h2>
          <p>Sign in with your authorized Restore Health admin account.</p>
          <form onSubmit={login} className="stack-form">
            <label>Email address<input type="email" name="email" autoComplete="username" placeholder="admin@restorehealth.in" required /></label>
            <label>Password<input type="password" name="password" autoComplete="current-password" placeholder="Enter your password" required /></label>
            {error && <div className="inline-error">{error}</div>}
            <button className="button button-primary button-wide" type="submit" disabled={loginBusy}>{loginBusy ? "Signing in…" : "Sign in securely"}<span>→</span></button>
          </form>
          <div className="login-foot">Admin access is verified against your active Firebase admin account. Passwords are not stored.</div>
        </div>
      </section>
    </main>;
  }

  const title = (heading: string, subtitle: string) => <div className="page-title-row"><div><div className="eyebrow">{activeLabel.toUpperCase()}</div><h1>{heading}</h1><p>{subtitle}</p></div><button className="button button-soft" onClick={() => void loadData()} disabled={dataLoading}><span className={dataLoading ? "spin" : ""}>↻</span> {dataLoading ? "Refreshing" : "Refresh data"}</button></div>;

  const renderOverview = () => <>
    {title("Good to see you, " + (admin.name.split(" ")[0] || "Admin"), "Here is the live status of your Restore Health platform.")}
    <div className="metric-grid metric-grid-4">
      <Metric icon="▤" label="Total orders" value={coins(data.orders.length)} note={`${totals.pendingOrders} need attention`} tone="blue" />
      <Metric icon="♙" label="Registered clients" value={coins(data.clients.length)} note="Live user records" tone="violet" />
      <Metric icon="₹" label="Gross booking value" value={inr(totals.grossPaise / 100)} note={`${inr(totals.commissionPaise / 100)} commission`} tone="green" />
      <Metric icon="◷" label="Pending orders" value={coins(totals.pendingOrders)} note={`${totals.failedOrders} failed orders`} tone="orange" />
    </div>
    <div className="section-heading"><div><h2>RHS Credits across clients</h2><p>Total RHS Credit = Practo + Redcliffe + Thyrocare.</p></div><button className="text-button" onClick={() => setSection("clients")}>Manage wallets <span>→</span></button></div>
    <div className="metric-grid metric-grid-4 wallet-metrics">
      <Metric icon="Σ" label="Total RHS Credit" value={inr(totals.totalWallet)} note="Practo + Redcliffe + Thyrocare" tone="green" />
      {walletOptions.map((wallet, index) => <Metric key={wallet.id} icon={wallet.icon} label={wallet.label} value={inr(totals.wallets[index])} note="Client balances combined" tone={wallet.color} />)}
    </div>
    <div className="content-grid overview-grid">
      <Panel title="Latest orders" subtitle="Newest live orders" action={<button className="text-button" onClick={() => setSection("orders")}>View queue →</button>}>
        <OrderTable orders={data.orders.slice().sort((a, b) => orderTimestamp(b) - orderTimestamp(a)).slice(0, 6)} compact />
      </Panel>
      <Panel title="Provider health" subtitle={data.health?.mode ? `Backend mode: ${data.health.mode}` : "Connection status"} action={<button className="text-button" onClick={() => setSection("integrations")}>Details →</button>}>
        <HealthList vendors={rows(data.health?.vendors)} errors={data.errors} />
      </Panel>
    </div>
    <Panel title="Recent admin activity" subtitle="Audit events from Firestore" action={<button className="text-button" onClick={() => setSection("activity")}>Open audit log →</button>}>
      <AuditTable logs={data.auditLogs.slice().sort((a, b) => dateValue(b.timestamp) - dateValue(a.timestamp)).slice(0, 6)} />
    </Panel>
  </>;

  const renderOrders = () => <>
    {title("Orders & bookings", "All client app orders in one queue. Check Thyrocare orders live to sync the latest provider status.")}
    <div className="metric-grid metric-grid-4">
      <Metric icon="▤" label="All orders" value={coins(data.orders.length)} tone="blue" />
      <Metric icon="◷" label="Pending" value={coins(totals.pendingOrders)} tone="orange" />
      <Metric icon="✓" label="Completed" value={coins(data.orders.filter((order) => text(order, "orderStatus").toUpperCase() === "COMPLETED").length)} tone="green" />
      <Metric icon="!" label="Failed" value={coins(totals.failedOrders)} tone="red" />
    </div>
    <Panel title="Order queue" subtitle={`${data.orders.length} records across all clients`} action={canMutate ? <button className="button button-primary" onClick={() => setDialog({ kind: "manualOrder" })}>＋ Manual order</button> : undefined}>
      <OrderHistory orders={data.orders} onRefresh={(order) => void runAction("refreshOrder", { orderId: order.id }, "Provider order status refreshed.").catch(() => undefined)} busy={busy} onStatus={(order) => setDialog({ kind: "orderStatus", order })} onRetry={(order) => void runAction("retryOrder", { orderId: order.id }, "Retry requested.").catch(() => undefined)} onRefund={(order) => setDialog({ kind: "refund", order })} canMutate={canMutate} />
    </Panel>
    <Panel title="Practo booking status" subtitle="Partner transaction records and manual client-status updates" action={<button className="button button-soft" onClick={() => setSection("consultations")}>Open Practo console →</button>}>
      <BookingTable bookings={data.practoBookings.slice().sort((a, b) => bookingTimestamp(b) - bookingTimestamp(a)).slice(0, 5)} onCheck={(booking) => void runAction("checkPracto", { transactionId: bookingTransaction(booking) }, "Practo status checked.").catch(() => undefined)} onPublish={(booking) => void runAction("publishPracto", { transactionId: bookingTransaction(booking) }, "Status published to client.").catch(() => undefined)} onSetClient={(booking) => setDialog({ kind: "clientStatus", booking })} canMutate={canMutate} compact />
    </Panel>
  </>;

  const renderClients = () => <>
  {title("Clients & wallets", "Open a client to review family member requests, profile details, orders, wallet history, and balances.")}
    <div className="metric-grid metric-grid-4">
      <Metric icon="♙" label="Clients" value={coins(data.clients.length)} tone="blue" />
      <Metric icon="Σ" label="Total RHS Credit" value={inr(totals.totalWallet)} tone="green" />
      <Metric icon="▤" label="Clients with orders" value={coins(new Set(data.orders.map((order) => text(order, "userId")).filter(Boolean)).size)} tone="violet" />
      <Metric icon="◷" label="Ledger entries" value={coins(data.ledger.length)} tone="orange" />
    </div>
    <div className="client-id-lookup"><div><strong>Open a client by ID</strong><small>Paste the exact Firebase client ID to manage their account.</small></div><form onSubmit={openClientById}><label className="sr-only" htmlFor="client-id-lookup">Client ID</label><input id="client-id-lookup" value={clientIdLookup} onChange={(event) => setClientIdLookup(event.target.value)} placeholder="Enter client ID" autoComplete="off" /><button className="button button-primary button-small" type="submit" disabled={!clientIdLookup.trim()}>Open client</button></form></div>
    <Panel title="Registered clients" subtitle={`${filteredClients.length} live profiles`} action={canManageLogins ? <button className="button button-primary" disabled={busy} onClick={() => setDialog({ kind: "newClient" })}>＋ Add client</button> : undefined}>
      <div className="table-wrap"><table><thead><tr><th>Client</th><th>Contact</th><th>Total RHS Credit</th>{walletOptions.map((wallet) => <th key={wallet.id}>{wallet.shortLabel} RHS Credit</th>)}<th>Orders</th><th>Family requests</th><th>Joined</th><th /></tr></thead><tbody>
        {filteredClients.map((client) => {
          const clientOrders = ordersForClient(client, data.orders);
          const total = walletOptions.reduce((sum, wallet) => sum + number(client, wallet.key), 0);
          return <tr key={client.id} className="clickable-row" onClick={() => setSelectedClientId(client.id)}>
            <td><div className="person-cell"><span className="avatar small-avatar">{initials(text(client, "name", "displayName", "email"))}</span><span><strong>{text(client, "name", "displayName") || "RHS member"}</strong><small>{client.id}</small><small className="cell-sub">{[text(client, "dateOfBirth"), text(client, "gender")].filter(Boolean).join(" · ")}</small></span></div></td>
            <td>{text(client, "email") || "—"}<small className="cell-sub">{text(client, "phone", "phoneNumber") || "No phone"}</small></td>
            <td><strong className="total-coins">{inr(total)}</strong></td>
            {walletOptions.map((wallet) => <td key={wallet.id}>{inr(number(client, wallet.key))}</td>)}
            <td>{clientOrders.length}</td><td>{pendingFamilyCount(client.id, data.familyMembers) > 0 ? <span className="family-pending-badge">{pendingFamilyCount(client.id, data.familyMembers)} pending</span> : "—"}</td><td>{dateText(client.createdAt)}</td><td><span className="row-arrow">→</span></td>
          </tr>;
        })}
        {filteredClients.length === 0 && <EmptyRow colSpan={10} text="No live clients match this search." />}
      </tbody></table></div>
    </Panel>
    <Panel title="Recent wallet activity" subtitle="Credits and debits recorded in the server ledger"><LedgerTable entries={data.ledger.slice(0, 10)} clients={data.clients} /></Panel>
  </>;

  const renderPhoneLogin = () => {
    const approvedCount = data.clients.filter((client) => phoneLoginStatus(client) === "APPROVED").length;
    const disabledCount = data.clients.filter((client) => phoneLoginStatus(client) === "DISABLED").length;
    const pendingCount = data.clients.length - approvedCount - disabledCount;
    return <>
      {title("Phone OTP access", "Verify a client's number and approve Firebase phone sign-in for their existing account.")}
      <div className="metric-grid metric-grid-4">
        <Metric icon="OTP" label="Registered clients" value={coins(data.clients.length)} note="Firebase user profiles" tone="blue" />
        <Metric icon="✓" label="OTP approved" value={coins(approvedCount)} note="Phone sign-in enabled" tone="green" />
        <Metric icon="…" label="Not approved" value={coins(pendingCount)} note="Needs admin review" tone="orange" />
        <Metric icon="!" label="Disabled" value={coins(disabledCount)} note="OTP sign-in blocked" tone="red" />
      </div>
      <div className="data-warning">Approve only after confirming the number with the client. The server saves it to the client&apos;s existing Firebase Auth account; Firebase Authentication verifies ownership by OTP when they sign in.</div>
      <Panel title="Client phone numbers" subtitle={`${filteredPhoneClients.length} matching client profiles`}>
        <div className="table-wrap"><table><thead><tr><th>Client</th><th>Phone on profile</th><th>Firebase OTP number</th><th>Login status</th><th>Last updated</th><th>Actions</th></tr></thead><tbody>
          {filteredPhoneClients.map((client) => {
            const login = phoneLoginRecord(client);
            const assignedPhone = String(login.phoneNumber ?? "");
            const status = phoneLoginStatus(client);
            return <tr key={client.id}>
              <td><div className="person-cell"><span className="avatar small-avatar">{initials(text(client, "name", "displayName", "email"))}</span><span><strong>{text(client, "name", "displayName") || "RHS member"}</strong><small>{client.id}</small></span></div></td>
              <td>{text(client, "phone", "phoneNumber") || "Not provided"}</td>
              <td>{assignedPhone || <span className="cell-sub">Not configured</span>}</td>
              <td><Status value={assignedPhone ? status : "NOT SET"} enabled={status === "APPROVED"} /></td>
              <td>{dateText(login.updatedAt || login.approvedAt)}</td>
              <td><div className="table-actions">
                {canManageLogins ? <>
                  <button className="text-button" disabled={busy} onClick={() => setDialog({ kind: "phoneLogin", client })}>{status === "APPROVED" ? "Change number" : "Verify & approve"}</button>
                  {status === "APPROVED" && <button className="text-button" disabled={busy} onClick={() => void runAction("setPhoneLogin", { userId: client.id, phoneNumber: assignedPhone, status: "NOT_APPROVED" }, "Phone OTP access revoked.").catch(() => undefined)}>Revoke</button>}
                </> : <span className="cell-sub">Login admin access required</span>}
              </div></td>
            </tr>;
          })}
          {filteredPhoneClients.length === 0 && <EmptyRow colSpan={6} text="No client phone records match this search." />}
        </tbody></table></div>
      </Panel>
    </>;
  };

  const renderProviders = () => <>
    {title("Provider integrations", "Manage provider availability, catalog synchronization, and integration credentials.")}
    <div className="toolbar-row">
      <div className="callout"><span className="live-dot" /> Provider list is loaded from the live companies collection.</div>
      {canMutate && <div className="button-row"><button className="button button-soft" onClick={() => void runAction("seedVendors", {}, "Provider registry refreshed.").catch(() => undefined)}>Seed registry</button><button className="button button-primary" onClick={() => setDialog({ kind: "partner" })}>＋ Add provider</button></div>}
    </div>
    <div className="provider-grid">
      {data.companies.map((company) => <article className="provider-card" key={company.id}>
        <div className="provider-card-top"><div className="provider-mark">{initials(text(company, "name", "code"))}</div><Status value={text(company, "integrationStatus", "healthStatus", "status")} enabled={flag(company, "enabled", true)} /><button className="icon-button" title="Refresh data" onClick={() => void loadData()} disabled={dataLoading}>↻</button></div>
        <h3>{text(company, "name") || "Unnamed provider"}</h3><p>{text(company, "tagline", "description") || "No provider description"}</p>
        <div className="provider-meta"><span>Code <strong>{text(company, "code") || company.id}</strong></span><span>Catalog <strong>{number(company, "productCount") || data.products.filter((product) => text(product, "companyId", "vendorId") === company.id).length} items</strong></span><span>Orders <strong>{number(company, "ordersCount")}</strong></span></div>
        <div className="provider-footer"><span className={`mode-pill ${text(company, "integrationType", "mode").toLowerCase() === "live" ? "mode-live" : ""}`}>{labelStatus(text(company, "integrationType", "catalogMode") || "Connected")}</span><span className="provider-actions">
          {canMutate && <><button className="text-button" onClick={() => void runAction("toggleVendor", { vendorId: company.id, enabled: !flag(company, "enabled", true) }, "Provider availability updated.").catch(() => undefined)}>{flag(company, "enabled", true) ? "Disable" : "Enable"}</button><button className="text-button" onClick={() => void runAction("syncVendor", { vendorId: company.id }, "Catalog sync completed.").catch(() => undefined)}>Sync catalog</button></>}
        </span></div>
        {canMutate && <button className="provider-sync-link" onClick={() => void runAction("requestVendorSync", { vendorId: company.id }, "Provider sync queued.").catch(() => undefined)}>Queue scheduled sync <span>→</span></button>}
      </article>)}
      {data.companies.length === 0 && <EmptyCard title="No providers returned" detail={data.errors.companies || "Add providers from the API-backed provider form or seed the live registry."} />}
    </div>
    <Panel title="Practo consult fee" subtitle={data.creditSettings?.practoConsultFeeRupees ? `Current: ${inr(data.creditSettings.practoConsultFeeRupees)}. Charged to Practo RHS Credit when Practo shares no doctor fee.` : "Not set: Practo bookings without a doctor fee are blocked until you set one."}>
      <form className="stack-form fee-form" onSubmit={(event) => { event.preventDefault(); const fee = Number(new FormData(event.currentTarget).get("fee")); void runAction("setPractoFee", { practoConsultFeeRupees: fee }, "Practo consult fee saved.").catch(() => undefined); }}>
        <input name="fee" type="number" min="1" max="100000" step="1" placeholder={String(data.creditSettings?.practoConsultFeeRupees || 499)} required disabled={!canMutate || busy} />
        <button className="button button-primary" disabled={!canMutate || busy}>Save fee</button>
      </form>
    </Panel>
    <Panel title="Provider status summary" subtitle="Live backend integration health"><HealthList vendors={rows(data.health?.vendors)} errors={data.errors} /></Panel>
  </>;

  const renderConsultations = () => <>
    {title("Practo consultations", "Review bookings and webhook consultations. Check provider status and publish updates to clients.")}
    {data.errors.practoConsultations && <div className="data-warning">Practo consultation feed: {data.errors.practoConsultations}</div>}
    <Panel title="Practo webhook consultations" subtitle={`${consultations.length} latest records`} action={<button className="button button-soft" onClick={() => void loadData()}>Refresh feed</button>}>
      <ConsultationTable consultations={consultations} />
    </Panel>
    <Panel title="Practo bookings" subtitle={`${data.practoBookings.length} live booking documents`}>
      <BookingTable bookings={data.practoBookings.slice().sort((a, b) => bookingTimestamp(b) - bookingTimestamp(a))} onCheck={(booking) => void runAction("checkPracto", { transactionId: bookingTransaction(booking) }, "Practo status checked.").catch(() => undefined)} onPublish={(booking) => void runAction("publishPracto", { transactionId: bookingTransaction(booking) }, "Status published to client.").catch(() => undefined)} onSetClient={(booking) => setDialog({ kind: "clientStatus", booking })} canMutate={canMutate} />
    </Panel>
  </>;

  const renderSupport = () => <>
    {title("Client support", "Reply to tickets submitted in the app or requests raised through Lucky AI.")}
    {data.errors.supportTickets && <div className="data-warning">Support queue: {data.errors.supportTickets}</div>}
    <Panel title="Open and replied tickets" subtitle={`${data.supportTickets.length} active client request${data.supportTickets.length === 1 ? "" : "s"}`}>
      <div className="support-ticket-list">
        {data.supportTickets.map((ticket) => {
          const reply = supportDrafts[ticket.id] || "";
          const customer = text(ticket, "name") || text(data.clients.find((client) => client.id === text(ticket, "uid")), "name", "displayName") || "Restore Health client";
          return <article className="support-ticket-card" key={ticket.id}>
            <div className="section-heading compact-heading">
              <div><h3>{text(ticket, "subject") || labelStatus(text(ticket, "topic") || "Support request")}</h3><p>{customer} · {text(ticket, "phone") || text(data.clients.find((client) => client.id === text(ticket, "uid")), "phone", "phoneNumber") || "No phone listed"}</p></div>
              <Status value={text(ticket, "status") || "OPEN"} enabled={text(ticket, "status") === "REPLIED"} />
            </div>
            <div className="support-ticket-meta"><span>{labelStatus(text(ticket, "category", "topic") || "Other")}</span><span>{labelStatus(text(ticket, "source") || "Support")}</span><span>{dateText(ticket.createdAt)}</span><span>ID {ticket.id}</span></div>
            {text(ticket, "message") ? <p className="support-ticket-message">{text(ticket, "message")}</p> : <p className="support-ticket-message">The client asked for help with {labelStatus(text(ticket, "topic") || "a support request")}.</p>}
            {text(ticket, "adminReply") && <div className="support-ticket-reply"><strong>Latest reply</strong><p>{text(ticket, "adminReply")}</p><small>{dateText(ticket.repliedAt)}</small></div>}
            <label className="support-reply-label">Reply to this client<textarea rows={3} maxLength={2000} value={reply} onChange={(event) => setSupportDrafts((current) => ({ ...current, [ticket.id]: event.target.value }))} placeholder="Write a clear reply. The client will receive it in their app." /></label>
            <div className="button-row"><button className="button button-primary" disabled={!canMutate || busy || reply.trim().length < 3} onClick={() => {
              void runAction("replySupportTicket", { ticketId: ticket.id, reply }, "Reply sent to the client.").then(() => setSupportDrafts((current) => ({ ...current, [ticket.id]: "" }))).catch(() => undefined);
            }}>{busy ? "Sending…" : "Send reply"}</button></div>
          </article>;
        })}
        {data.supportTickets.length === 0 && <EmptyText text={data.errors.supportTickets || "No active support tickets."} />}
      </div>
    </Panel>
  </>;

  const renderFinance = () => <>
    {title("Finance & settlements", "Review live settlement batches and revenue totals. Finance updates are recorded to Firestore.")}
    <div className="metric-grid metric-grid-4"><Metric icon="₹" label="Gross booking value" value={inr(totals.grossPaise / 100)} tone="green" /><Metric icon="↗" label="Commission earned" value={inr(totals.commissionPaise / 100)} tone="blue" /><Metric icon="◷" label="Settlement batches" value={coins(data.settlements.length)} tone="violet" /><Metric icon="!" label="Open mismatches" value={coins(data.settlements.filter((item) => !!item.mismatchNote || text(item, "status").toUpperCase().includes("MISMATCH")).length)} tone="orange" /></div>
    <Panel title="Settlement batches" subtitle={`${data.settlements.length} live records`}><SettlementTable settlements={data.settlements} canFinance={canFinance} onAction={(action, settlement) => void runAction(action, { settlementId: settlement.id }, "Settlement updated.").catch(() => undefined)} /></Panel>
    <div className="content-grid"><Panel title="Revenue by provider" subtitle="Gross and commission from recorded orders"><ProviderRevenue orders={data.orders} companies={data.companies} /></Panel><Panel title="Partner payable" subtitle="Amounts calculated from live order records"><div className="stat-list">{data.companies.map((company) => { const orders = data.orders.filter((order) => text(order, "companyId", "companyCode").toLowerCase() === company.id.toLowerCase() || text(order, "companyName").toLowerCase() === text(company, "name").toLowerCase()); const amount = orders.reduce((sum, order) => sum + number(order, "partnerPayablePaise"), 0); return <div className="stat-row" key={company.id}><span>{text(company, "name") || company.id}</span><strong>{inr(amount / 100)}</strong></div>; })}{data.companies.length === 0 && <EmptyText text="No live provider records." />}</div></Panel></div>
  </>;

  const renderCatalog = () => {
    const editingThyrocareApiRate = pricingVendor === "thyrocare";
    const filtered = pricingItems.filter((item) => !query || [item.name, item.category, item.type, item.qualifications].some((value) => String(value ?? "").toLowerCase().includes(query)));
    const grouped = new Map<string, Row[]>();
    for (const item of filtered) {
      const category = text(item, "category", "type") || "Other";
      grouped.set(category, [...(grouped.get(category) || []), item]);
    }
    const groups = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));
    return <>
      {title("Provider pricing", editingThyrocareApiRate
        ? "Set the rate sent in Thyrocare price quotes. New checkouts use the updated quote when calculating the wallet charge."
        : "Edit the customer price, then approve it to publish that amount in the app. Fixed MRP and provider booking requests stay unchanged.")}
      <Panel title="Provider and category" subtitle={editingThyrocareApiRate
        ? "The Thyrocare rate is sent as rate.mrp to /cart/price-breakup. The final /orders request contains product IDs and does not accept a rate override."
        : "My rate and margin are admin-only. Approving a customer price publishes it immediately to the app."}>
        <div className="toolbar-row">
          <label>Provider<select value={pricingVendor} onChange={(event) => { setPricingOffset(0); setPricingVendor(event.target.value); }}>
            <option value="practo">Practo doctors</option><option value="redcliffe">Redcliffe tests</option><option value="thyrocare">Thyrocare tests</option>
          </select></label>
          {pricingVendor === "practo" && <label>Speciality<select value={pricingSpeciality} onChange={(event) => { setPricingOffset(0); setPricingSpeciality(event.target.value); }}>
            {pricingSpecialities.map((speciality) => <option key={speciality.id} value={speciality.id}>{text(speciality, "name")}</option>)}
          </select></label>}
          <span>{pricingLoading ? "Loading live provider catalog…" : `${pricingVendor === "practo" ? `${pricingOffset + 1}–${pricingOffset + pricingItems.length} of ` : ""}${pricingTotal} available`}</span>
          {pricingVendor === "practo" && <div className="button-row"><button className="button button-soft" disabled={pricingLoading || pricingOffset <= 0} onClick={() => setPricingOffset((value) => Math.max(0, value - 100))}>Previous</button><button className="button button-soft" disabled={pricingLoading || pricingOffset + pricingItems.length >= pricingTotal} onClick={() => setPricingOffset((value) => value + 100)}>Next</button></div>}
          {pricingVendor !== "practo" && <button className="button button-soft" onClick={() => setSection("providers")}>Sync a provider →</button>}
        </div>
      {pricingVendor === "practo" && <p className="cell-sub">Doctor results are paged 100 at a time. Doctors without a provider fee use the Practo default fee as the rate estimate.</p>}
      </Panel>
      {pricingError && <div className="data-warning">{pricingError}</div>}
      {pricingLoading && <Panel title="Loading catalog" subtitle="Fetching current provider prices…"><p>Loading live catalog…</p></Panel>}
      {!pricingLoading && !pricingError && groups.map(([category, items]) => <Panel key={category} title={labelStatus(category)} subtitle={`${items.length} ${pricingVendor === "practo" ? "doctors" : "tests and packages"}`}>
        <div className="table-wrap"><table><thead><tr><th>{pricingVendor === "practo" ? "Doctor" : "Product"}</th><th>Experience / Type</th><th>{editingThyrocareApiRate ? "Catalog MRP" : "Fixed MRP"}</th><th>{editingThyrocareApiRate ? "Rate sent to API" : "My rate"}</th><th>{editingThyrocareApiRate ? "Catalog price" : "Live app price"}</th><th>Margin</th><th>{editingThyrocareApiRate ? "Update API rate" : "Approve & publish"}</th></tr></thead><tbody>
          {items.map((item) => {
            const partnerRate = number(item, "partnerRatePaise") / 100;
            const providerApiRate = number(item, "providerApiRatePaise") / 100;
            const customerPrice = number(item, "customerPricePaise") / 100;
            const margin = number(item, "marginPaise") / 100;
            const marginPercent = number(item, "marginPercent");
            return <tr key={item.id}>
              <td><strong>{text(item, "name")}</strong>{text(item, "qualifications") && <small className="cell-sub">{text(item, "qualifications")}</small>}</td>
              <td>{pricingVendor === "practo" ? (item.experienceYears == null ? "Experience not listed" : `${number(item, "experienceYears")} years`) : labelStatus(text(item, "type"))}{item.providerFeeAvailable === false && <small className="cell-sub">Default fee estimate</small>}</td>
              <td>{number(item, "mrpPaise") ? inrExact(number(item, "mrpPaise") / 100) : "Not shared"}</td>
              <td>{editingThyrocareApiRate ? inrExact(providerApiRate) : partnerRate ? inrExact(partnerRate) : "Not shared"}</td>
              <td>{inrExact(customerPrice)}</td>
              <td>{editingThyrocareApiRate ? "—" : <><strong>{inrExact(margin)}</strong><small className="cell-sub">{marginPercent.toFixed(2)}%</small></>}</td>
              <td><form className="toolbar-row" onSubmit={(event) => {
                event.preventDefault();
                const values = new FormData(event.currentTarget);
                if (editingThyrocareApiRate) {
                  const providerApiRateRupees = Number(values.get("providerApiRateRupees"));
                  void runAction("setProviderApiRate", {
                    vendorId: pricingVendor,
                    itemId: text(item, "itemId"),
                    providerApiRateRupees,
                  }, "Thyrocare API quote rate updated. New checkouts will use the updated quote.").then(() => setPricingRefresh((value) => value + 1)).catch(() => undefined);
                } else {
                  const customerPriceRupees = Number(values.get("customerPriceRupees"));
                  void runAction("setCatalogPrice", {
                    vendorId: pricingVendor,
                    itemId: text(item, "itemId"),
                    specialityId: text(item, "specialityId"),
                    customerPriceRupees,
                  }, "Customer price approved and published to the app. Fixed MRP and provider booking remain unchanged.").then(() => setPricingRefresh((value) => value + 1)).catch(() => undefined);
                }
              }}>
                {editingThyrocareApiRate
                  ? <input name="providerApiRateRupees" type="number" min="1" max="100000" step="0.01" defaultValue={providerApiRate.toFixed(2)} aria-label={`Thyrocare API rate for ${text(item, "name")}`} disabled={!canMutate || busy} required />
                  : <input name="customerPriceRupees" type="number" min="1" max={Math.max(1, number(item, "mrpPaise") / 100)} step="0.01" defaultValue={customerPrice.toFixed(2)} aria-label={`Customer price for ${text(item, "name")}`} disabled={!canMutate || busy} required />}
                <button className="button button-primary" disabled={!canMutate || busy}>{busy ? (editingThyrocareApiRate ? "Updating…" : "Publishing…") : (editingThyrocareApiRate ? "Update rate" : "Approve & publish")}</button>
              </form></td>
            </tr>;
          })}
          {items.length === 0 && <EmptyRow colSpan={7} text="No matching products in this category." />}
        </tbody></table></div>
      </Panel>)}
      {!pricingLoading && !pricingError && filtered.length === 0 && <Panel title="No products loaded" subtitle="Choose another provider, speciality, or search term."><p>No matching provider entries are available.</p></Panel>}
      <Panel title="Synced catalog records" subtitle={`${data.products.length} products last synced to the admin collection`} action={<button className="button button-soft" onClick={() => setSection("providers")}>Provider sync →</button>}>
        <div className="table-wrap"><table><thead><tr><th>Product</th><th>Provider</th><th>Type</th><th>Last synced price</th><th>Updated</th></tr></thead><tbody>
          {data.products.slice(0, 100).map((product) => <tr key={product.id}><td>{text(product, "name", "title", "productName") || "Untitled product"}</td><td>{text(product, "companyName", "vendorName", "vendorId", "companyId") || "—"}</td><td>{labelStatus(text(product, "type", "category") || "Service")}</td><td>{inr(number(product, "pricePaise") ? number(product, "pricePaise") / 100 : number(product, "price"))}</td><td>{dateText(product.updatedAt || product.syncedAt)}</td></tr>)}
          {data.products.length === 0 && <EmptyRow colSpan={5} text={data.errors.products || "No sync records found."} />}
        </tbody></table></div>
      </Panel>
    </>;
  };

  const renderPlans = () => {
    const today = todayISO;
    const availableMembershipPlans = data.membershipPlans.filter((plan) => plan.active !== false);
    const selectedClient = data.clients.find((client) => client.id === planAssignmentClientId) ?? null;
    const selectedClientPlan = selectedClient?.plan && typeof selectedClient.plan === "object" ? selectedClient.plan as Row : null;
    const selectedPlan = availableMembershipPlans.find((plan) => plan.id === planAssignmentTemplateId) ?? null;
    const assignedClients = data.clients.filter((client) => !!client.plan && typeof client.plan === "object");
    const activePlans = assignedClients.filter((client) => {
      const plan = client.plan as Row;
      return text(plan, "status").toUpperCase() === "ACTIVE" && (!text(plan, "startDate") || text(plan, "startDate") <= today) && (!text(plan, "expiryDate") || text(plan, "expiryDate") >= today);
    }).length;
    const recentCampaigns = data.auditLogs.filter((entry) => ["ADMIN_NOTIFICATION_SENT", "ADMIN_NOTIFICATION_SCHEDULED_SENT", "ADMIN_NOTIFICATION_SCHEDULED", "ADMIN_NOTIFICATION_FAILED", "ADMIN_NOTIFICATION_CANCELLED", "ADMIN_NOTIFICATION_RETRY_SCHEDULED"].includes(text(entry, "action"))).slice(0, 12);
    const notificationAudienceCount = notificationTarget === "all"
      ? data.clients.length
      : notificationTarget === "user" ? (notificationSingleUserId ? 1 : 0)
      : notificationTarget === "users" ? notificationUserIds.length
      : data.clients.filter((client) => {
        const plan = client.plan && typeof client.plan === "object" ? client.plan as Row : null;
        const active = !!plan && text(plan, "status").toUpperCase() === "ACTIVE" && (!text(plan, "startDate") || text(plan, "startDate") <= today) && (!text(plan, "expiryDate") || text(plan, "expiryDate") >= today);
        return notificationTarget === "active_plan" ? active : !active;
      }).length;
    const filteredNotificationClients = data.clients.filter((client) => {
      const needle = notificationClientSearch.trim().toLowerCase();
      return !needle || [client.id, client.name, client.displayName, client.phone, client.phoneNumber, client.email]
        .some((value) => String(value ?? "").toLowerCase().includes(needle));
    }).slice(0, 100);

    const manageClientPlan = (client: Row) => {
      const current = client.plan as Row | undefined;
      const template = data.membershipPlans.find((plan) => plan.id === text(current, "planId"));
      setPlanAssignmentClientId(client.id);
      setPlanAssignmentTemplateId(template?.id ?? "");
      setPlanAssignmentValidityDays(String(number(template, "validityDays") || 365));
      setPlanPaymentAmount((number(current, "paymentAmountPaise") / 100 || number(template, "pricePaise") / 100).toFixed(2));
      setPlanAssignmentStartDate(text(current, "startDate") || todayISO);
    };

    return <>
      {title("Plans & client communications", "Manage reusable benefits, paid client assignments, and targeted in-app updates.")}
      <div className="metric-grid metric-grid-4">
        <Metric icon="R+" label="Plan templates" value={coins(data.membershipPlans.length)} tone="green" />
        <Metric icon="✓" label="Available plans" value={coins(availableMembershipPlans.length)} tone="blue" />
        <Metric icon="♙" label="Clients with plans" value={coins(assignedClients.length)} tone="violet" />
        <Metric icon="✓" label="Active today" value={coins(activePlans)} tone="green" />
      </div>
      <div className="luxury-banner"><span className="luxury-banner-mark">R</span><div><strong>Membership operations</strong><p>Templates are reusable. A plan appears in a client's account only after an admin confirms payment and assigns it to that client.</p></div><span className="status-pill status-good">Client scoped</span></div>

      <div className="content-grid admin-tools-grid">
        <Panel title={editingMembershipPlan ? "Edit plan template" : "Build a plan template"} subtitle="Set customer price, validity, description, and each included benefit.">
          {canMutate ? <PlanTemplateForm
            key={editingMembershipPlan?.id ?? "new-plan"}
            initialPlan={editingMembershipPlan}
            busy={busy}
            onCancel={editingMembershipPlan ? () => setEditingMembershipPlan(null) : undefined}
            onSubmit={(draft) => {
              void runAction("saveMembershipPlan", draft, editingMembershipPlan ? "Plan template updated." : "Plan template created.")
                .then(() => setEditingMembershipPlan(null))
                .catch(() => undefined);
            }}
          /> : <div className="empty-state">This admin account has read-only access.</div>}
          <div className="plan-template-list">
            {data.membershipPlans.map((plan) => {
              const benefits = Array.isArray(plan.benefits) ? plan.benefits as Array<Record<string, unknown>> : [];
              const available = plan.active !== false;
              return <article className="plan-template-card" key={plan.id}>
                <div className="plan-template-main">
                  <div className="plan-template-top"><strong>{text(plan, "name")}</strong><span className={`status-pill ${available ? "status-good" : "status-muted"}`}>{available ? "Available" : "Archived"}</span></div>
                  <p>{text(plan, "description") || "No description added."}</p>
                  <div className="plan-template-meta"><b>{number(plan, "pricePaise") ? inr(number(plan, "pricePaise") / 100) : "Price not set"}</b><span>{number(plan, "validityDays") || 365} days</span><span>{benefits.length} benefits</span></div>
                  <small>{benefits.map((benefit) => `${String(benefit.title ?? "Benefit")} · ${String(benefit.limit ?? 1)} / ${String(benefit.period ?? "plan")}`).join("  |  ") || "No benefits"}</small>
                </div>
                {canMutate && <div className="plan-template-actions">
                  <button className="button button-soft button-small" onClick={() => setEditingMembershipPlan(plan)}>Edit</button>
                  <button className={`button button-small ${available ? "button-danger-soft" : "button-soft"}`} disabled={busy} onClick={() => {
                    void runAction("saveMembershipPlan", {
                      planId: plan.id,
                      name: text(plan, "name"),
                      description: text(plan, "description"),
                      pricePaise: number(plan, "pricePaise"),
                      validityDays: number(plan, "validityDays") || 365,
                      active: !available,
                      benefits,
                    }, available ? "Plan archived. Existing client assignments remain active." : "Plan restored for new assignments.").catch(() => undefined);
                  }}>{available ? "Archive" : "Restore"}</button>
                </div>}
              </article>;
            })}
            {data.membershipPlans.length === 0 && <p className="cell-sub">No templates yet. Create Restore Health Services Plan 1 above.</p>}
          </div>
        </Panel>

        <Panel title="Assign or renew for a client" subtitle="Record the payment and set the start date and validity. The client receives an in-app notification.">
          {data.errors.membershipPlans && <div className="data-warning"><span>!</span><span>Plan templates could not be loaded: {data.errors.membershipPlans}</span><button className="button button-small button-soft" onClick={() => void loadData()} disabled={dataLoading}>Retry</button></div>}
          {canMutate ? <form className="stack-form management-form" onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const values = formObject(form);
            const client = data.clients.find((item) => item.id === String(values.userId));
            const template = availableMembershipPlans.find((item) => item.id === String(values.planId));
            if (!client || !template) { setError("Choose a client and an available plan."); return; }
            const days = Math.max(1, Math.min(3650, Number(values.validityDays) || number(template, "validityDays") || 365));
            const [year, month, day] = String(values.startDate).split("-").map(Number);
            const expiry = new Date(Date.UTC(year, month - 1, day + days - 1));
            const paymentPaise = Math.round(Number(values.paymentAmountRupees) * 100);
            void runAction("setUserPlan", {
              userId: client.id,
              planId: template.id,
              name: text(template, "name"),
              description: text(template, "description"),
              pricePaise: number(template, "pricePaise"),
              startDate: String(values.startDate),
              expiryDate: expiry.toISOString().slice(0, 10),
              paymentConfirmed: true,
              paymentReference: values.paymentReference,
              paymentMethod: values.paymentMethod,
              paymentAmountPaise: Number.isFinite(paymentPaise) ? paymentPaise : number(template, "pricePaise"),
              adminNote: values.adminNote,
              benefits: Array.isArray(template.benefits) ? template.benefits : [],
            }, "Plan assigned. The client has been notified.").catch(() => undefined);
          }}>
            <label>Client<select name="userId" value={planAssignmentClientId} onChange={(event) => setPlanAssignmentClientId(event.target.value)} required><option value="" disabled>Select client</option>{data.clients.map((client) => <option key={client.id} value={client.id}>{text(client, "name", "displayName") || client.id} · {text(client, "phone", "phoneNumber", "email")}</option>)}</select></label>
            <label>Available plan<select name="planId" value={availableMembershipPlans.some((plan) => plan.id === planAssignmentTemplateId) ? planAssignmentTemplateId : ""} onChange={(event) => {
              const id = event.target.value;
              const template = availableMembershipPlans.find((plan) => plan.id === id);
              setPlanAssignmentTemplateId(id);
              setPlanAssignmentValidityDays(String(number(template, "validityDays") || 365));
              setPlanPaymentAmount(template ? (number(template, "pricePaise") / 100).toFixed(2) : "");
            }} required><option value="" disabled>{data.errors.membershipPlans ? "Plan list could not be loaded" : availableMembershipPlans.length === 0 ? data.membershipPlans.length > 0 ? "No active plan templates" : "No plan templates created" : "Select plan"}</option>{availableMembershipPlans.map((plan) => <option key={plan.id} value={plan.id}>{text(plan, "name")} · {number(plan, "pricePaise") ? inr(number(plan, "pricePaise") / 100) : "price not set"}</option>)}</select></label>
            {!data.errors.membershipPlans && availableMembershipPlans.length === 0 && <p className="cell-sub">{data.membershipPlans.length > 0 ? "All templates are archived. Restore one above to assign it." : "Create a plan template above before assigning a plan to a client."}</p>}
            {selectedClientPlan && <div className="current-plan-notice"><strong>Current assignment: {text(selectedClientPlan, "name")}</strong><span>{text(selectedClientPlan, "status") === "ACTIVE" && text(selectedClientPlan, "startDate") > today ? `Scheduled · starts ${text(selectedClientPlan, "startDate")}` : `${labelStatus(text(selectedClientPlan, "status") || "Unknown")} · expires ${text(selectedClientPlan, "expiryDate") || "date not set"}`}</span><small>Assigning another plan replaces the current plan. Past assignments stay in the audit log.</small></div>}
            {selectedPlan && text(selectedPlan, "description") && <p className="plan-description-preview">{text(selectedPlan, "description")}</p>}
            <div className="form-grid"><label>Starts on<input name="startDate" type="date" value={planAssignmentStartDate} onChange={(event) => setPlanAssignmentStartDate(event.target.value)} required /></label><label>Validity (days)<input name="validityDays" type="number" min="1" max="3650" value={planAssignmentValidityDays} onChange={(event) => setPlanAssignmentValidityDays(event.target.value)} required /></label></div>
            <div className="form-grid"><label>Amount received (₹)<input name="paymentAmountRupees" type="number" min="0" step="0.01" value={planPaymentAmount} onChange={(event) => setPlanPaymentAmount(event.target.value)} required /></label><label>Payment method<select name="paymentMethod" defaultValue="upi"><option value="upi">UPI</option><option value="card">Card</option><option value="bank_transfer">Bank transfer</option><option value="cash">Cash</option><option value="other">Other</option></select></label></div>
            <label>Payment reference<input name="paymentReference" placeholder="Receipt / UTR / transaction ID" maxLength={120} required /></label>
            <label>Admin note <span className="optional">optional</span><textarea name="adminNote" rows={2} maxLength={500} placeholder="Internal note for this assignment" /></label>
            <label className="confirm-check"><input name="paymentConfirmed" type="checkbox" required /><span>Payment received and verified. Client will be notified.</span></label>
            <button className="button button-primary" disabled={busy || !planAssignmentTemplateId}>{busy ? "Saving assignment…" : selectedClientPlan ? "Replace / renew client plan" : "Assign paid plan to client"}</button>
          </form> : <div className="empty-state">This admin account has read-only access.</div>}
        </Panel>
      </div>

      <Panel title="Client plan register" subtitle="Review each current assignment, payment reference, paid amount, and validity. Deactivation takes effect immediately.">
        <div className="table-wrap"><table><thead><tr><th>Client</th><th>Plan</th><th>Status</th><th>Valid from</th><th>Valid to</th><th>Payment reference</th><th>Paid</th><th>Actions</th></tr></thead><tbody>
          {assignedClients.map((client) => {
            const plan = client.plan as Row;
            const active = text(plan, "status").toUpperCase() === "ACTIVE" && (!text(plan, "startDate") || text(plan, "startDate") <= today) && (!text(plan, "expiryDate") || text(plan, "expiryDate") >= today);
            const scheduled = text(plan, "status").toUpperCase() === "ACTIVE" && text(plan, "startDate") > today;
            return <tr key={client.id}><td><strong>{text(client, "name", "displayName") || client.id}</strong><small className="cell-sub">{text(client, "phone", "phoneNumber", "email")}</small></td><td>{text(plan, "name") || "Plan"}<small className="cell-sub">{Array.isArray(plan.benefits) ? `${plan.benefits.length} benefits` : ""}</small></td><td><span className={`status-pill ${active ? "status-good" : "status-muted"}`}>{scheduled ? "Scheduled" : active ? "Active" : labelStatus(text(plan, "status") || "Expired")}</span></td><td>{text(plan, "startDate") || "—"}</td><td>{text(plan, "expiryDate") || "—"}</td><td>{text(plan, "paymentReference") || "—"}</td><td>{number(plan, "paymentAmountPaise") ? inr(number(plan, "paymentAmountPaise") / 100) : "—"}</td><td><div className="button-row"><button className="button button-soft button-small" onClick={() => manageClientPlan(client)}>Manage</button>{canMutate && active && <button className="button button-danger-soft button-small" disabled={busy} onClick={() => {
              if (window.confirm(`Deactivate ${text(plan, "name") || "this plan"} for ${text(client, "name", "displayName") || client.id}?`)) {
                void runAction("deactivateUserPlan", { userId: client.id }, "Client plan deactivated.").catch(() => undefined);
              }
            }}>Deactivate</button>}</div></td></tr>;
          })}
          {assignedClients.length === 0 && <EmptyRow colSpan={8} text="No client plans have been assigned yet." />}
        </tbody></table></div>
      </Panel>

      <Panel title="Plan assignment history" subtitle="Past subscriptions remain recorded when a plan is replaced or deactivated.">
        <div className="table-wrap"><table><thead><tr><th>Client</th><th>Plan</th><th>Status</th><th>Validity</th><th>Payment</th><th>Reference</th><th>Assigned</th><th>Admin note</th></tr></thead><tbody>
          {data.membershipHistory.slice(0, 100).map((entry) => {
            const client = data.clients.find((item) => item.id === text(entry, "userId"));
            const futureStart = text(entry, "startDate") > today;
            return <tr key={entry.id}><td>{text(client, "name", "displayName") || text(entry, "userId") || "Unknown client"}<small className="cell-sub">{text(client, "phone", "phoneNumber", "email")}</small></td><td>{text(entry, "name")}</td><td><Status value={futureStart && text(entry, "status") === "ACTIVE" ? "Scheduled" : text(entry, "status") || "Unknown"} enabled={text(entry, "status") === "ACTIVE" && !futureStart} /></td><td>{text(entry, "startDate")} → {text(entry, "expiryDate")}</td><td>{number(entry, "paymentAmountPaise") ? `${inr(number(entry, "paymentAmountPaise") / 100)} · ${labelStatus(text(entry, "paymentMethod"))}` : "—"}</td><td>{text(entry, "paymentReference") || "—"}</td><td>{dateText(entry.assignedAt)}</td><td>{text(entry, "adminNote") || "—"}</td></tr>;
          })}
          {data.membershipHistory.length === 0 && <EmptyRow colSpan={8} text="Plan assignments will be added to this history when activated." />}
        </tbody></table></div>
      </Panel>

      <Panel title="Notification campaign" subtitle="Save an app inbox notice, send optional push, target a client group, set urgency, and add an in-app action.">
        {canMutate ? <form className="stack-form management-form announcement-form" onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const values = formObject(form);
          const userIds = new FormData(form).getAll("userIds").map(String).filter(Boolean);
          if (notificationTarget === "users" && !userIds.length) { setError("Select at least one client for this campaign."); return; }
          const route = String(values.actionRoute || "");
          const scheduledAt = notificationTiming === "scheduled" && values.scheduledAt
            ? new Date(String(values.scheduledAt)).toISOString()
            : undefined;
          void runAction("sendNotification", {
            target: notificationTarget,
            userId: notificationTarget === "user" ? notificationSingleUserId : undefined,
            userIds: notificationTarget === "users" ? userIds : [],
            title: values.title,
            body: values.body,
            type: notificationType,
            priority: notificationPriority,
            pushEnabled: notificationPushEnabled,
            actionRoute: route,
            actionLabel: route ? values.actionLabel : "",
            ...(scheduledAt ? { scheduledAt } : {}),
          }, scheduledAt ? "Notification scheduled." : "Notification sent.").then((result) => {
            const sent = result && typeof result === "object" ? result as Record<string, unknown> : {};
            setNotice(sent.scheduled === true
              ? `Campaign scheduled for ${dateText(sent.scheduledAt)}.`
              : `Sent to ${number(sent as Row, "recipients")} client(s); ${number(sent as Row, "pushSent")} push(es) delivered${sent.truncated === true ? " (10,000 recipient cap reached)" : ""}.`);
            setNotificationTitle(""); setNotificationBody(""); setNotificationUserIds([]); setNotificationTarget("all");
            setNotificationSingleUserId(""); setNotificationActionRoute(""); setNotificationActionLabel("");
            setNotificationPushEnabled(true);
            setNotificationTiming("now"); setNotificationClientSearch("");
            const nextScheduleBase = new Date();
            setNotificationScheduleMin(localDateTimeInput(new Date(nextScheduleBase.getTime() + 60_000)));
            setNotificationScheduledAt(localDateTimeInput(new Date(nextScheduleBase.getTime() + 5 * 60_000)));
            form.reset();
          }).catch(() => undefined);
        }}>
          <div className="form-grid"><label>Audience<select name="target" value={notificationTarget} onChange={(event) => setNotificationTarget(event.target.value as NotificationTarget)}><option value="all">All clients</option><option value="active_plan">Active plan holders</option><option value="no_active_plan">Clients without an active plan</option><option value="user">One selected client</option><option value="users">Selected clients (up to 200)</option></select></label><label>Category<select name="type" value={notificationType} onChange={(event) => setNotificationType(event.target.value)}><option value="announcement">Announcement</option><option value="plan">Plan update</option><option value="booking">Booking update</option><option value="report">Report update</option><option value="health">Health update</option><option value="payment">Payment update</option></select></label></div>
          {notificationTarget === "user" && <label>Client<select name="userId" value={notificationSingleUserId} onChange={(event) => setNotificationSingleUserId(event.target.value)} required><option value="">Select client</option>{data.clients.map((client) => <option key={client.id} value={client.id}>{text(client, "name", "displayName") || client.id} · {text(client, "phone", "phoneNumber", "email")}</option>)}</select></label>}
          {notificationTarget === "users" && <div className="notification-client-picker"><label>Find clients<input value={notificationClientSearch} onChange={(event) => setNotificationClientSearch(event.target.value)} placeholder="Search name, phone, email or UID" /></label><div className="notification-client-list">{filteredNotificationClients.map((client) => {
            const checked = notificationUserIds.includes(client.id);
            const disabled = !checked && notificationUserIds.length >= 200;
            return <label className="notification-client-option" key={client.id}><input type="checkbox" name="userIds" value={client.id} checked={checked} disabled={disabled} onChange={(event) => setNotificationUserIds((current) => event.target.checked ? [...current, client.id] : current.filter((uid) => uid !== client.id))} /><span><strong>{text(client, "name", "displayName") || "RHS member"}</strong><small>{text(client, "phone", "phoneNumber", "email") || client.id}</small></span></label>;
          })}{filteredNotificationClients.length === 0 && <p className="cell-sub">No clients match this search.</p>}</div><small className="cell-sub">{notificationUserIds.length} selected · up to 200 accounts. Showing the first 100 search matches.</small></div>}
          <label>Headline<input name="title" value={notificationTitle} onChange={(event) => setNotificationTitle(event.target.value)} placeholder="Your health update" maxLength={100} required /></label>
          <label>Message<textarea name="body" value={notificationBody} onChange={(event) => setNotificationBody(event.target.value)} placeholder="Write a clear update for your clients" rows={4} maxLength={500} required /></label>
          <div className="form-grid"><label>Urgency<select name="priority" value={notificationPriority} onChange={(event) => setNotificationPriority(event.target.value)}><option value="normal">Normal</option><option value="high">High priority</option></select></label><label>In-app action<select name="actionRoute" value={notificationActionRoute} onChange={(event) => setNotificationActionRoute(event.target.value)}><option value="">No button</option><option value="/plan-benefits">Open my plan</option><option value="/my-orders">View bookings &amp; orders</option><option value="/view-report">Open health reports</option><option value="/book-now">Browse care services</option><option value="/lab-marketplace">Browse lab tests</option><option value="/health-wellness">Open health &amp; wellness</option><option value="/family">Open family members</option><option value="/support">Contact support</option><option value="/notifications">Open notifications</option></select></label></div>
          {notificationActionRoute && <label>Action button text<input name="actionLabel" value={notificationActionLabel} onChange={(event) => setNotificationActionLabel(event.target.value)} placeholder="View details" maxLength={40} /></label>}
          <label className="notification-push-toggle"><input type="checkbox" checked={notificationPushEnabled} onChange={(event) => setNotificationPushEnabled(event.target.checked)} /><span><strong>Send a device push</strong><small>The in-app inbox notice is always saved, even when push is turned off.</small></span></label>
          <div className="notification-preview"><span className="eyebrow">CLIENT PREVIEW</span><strong>{notificationTitle || "Your notification headline"}</strong><p>{notificationBody || "The client will see this message in their inbox."}</p>{notificationActionRoute && <span className="notification-preview-action">{notificationActionLabel || "View details"} →</span>}</div>
          <div className="notification-audience-summary"><strong>{coins(notificationAudienceCount)} clients</strong><span>{labelStatus(notificationTarget.replaceAll("_", " "))} · {notificationPriority === "high" ? "high priority" : "normal priority"} · {notificationPushEnabled ? "push on" : "in-app only"}</span></div>
          <div className="form-grid"><label>Delivery<select value={notificationTiming} onChange={(event) => setNotificationTiming(event.target.value as NotificationTiming)}><option value="now">Send now</option><option value="scheduled">Schedule for later</option></select></label>{notificationTiming === "scheduled" && <label>Send at (local time)<input name="scheduledAt" type="datetime-local" min={notificationScheduleMin} value={notificationScheduledAt} onChange={(event) => setNotificationScheduledAt(event.target.value)} required /></label>}</div>
          <div className="notification-send-row"><span>Inbox notice is saved for every recipient. Push delivery depends on device tokens and notification permission. Broadcast is capped at 10,000 recipients per send.</span><button className="button button-primary" disabled={busy || (notificationTarget === "users" && !notificationUserIds.length)}>{busy ? "Saving..." : notificationTiming === "scheduled" ? "Schedule notification" : "Send notification"}</button></div>
        </form> : <div className="empty-state">This admin account has read-only access.</div>}
      </Panel>

      <Panel title="Recent notification campaigns" subtitle="Recent sends and delivery summaries are recorded in the admin audit log.">
        <div className="table-wrap"><table><thead><tr><th>Campaign summary</th><th>Admin</th><th>Activity at</th></tr></thead><tbody>{recentCampaigns.map((entry) => <tr key={entry.id}><td>{text(entry, "summary")}</td><td>{text(entry, "adminName") || text(entry, "adminUid")}</td><td>{dateText(entry.timestamp || entry.createdAt)}</td></tr>)}{recentCampaigns.length === 0 && <EmptyRow colSpan={3} text="Campaign history will show after the first send." />}</tbody></table></div>
      </Panel>
      <Panel title="Scheduled notifications" subtitle="Pending campaigns are delivered once their scheduled time arrives. You can cancel a pending campaign.">
        <div className="table-wrap"><table><thead><tr><th>Campaign</th><th>Audience</th><th>Scheduled for</th><th>Status</th><th>Action</th></tr></thead><tbody>
          {data.scheduledNotifications.map((campaign) => <tr key={campaign.id}><td><strong>{text(campaign, "title")}</strong><small className="cell-sub">{text(campaign, "body")}</small>{text(campaign, "lastError") && <small className="notification-error">{text(campaign, "lastError")}</small>}</td><td>{labelStatus(text(campaign, "target"))}{text(campaign, "target") === "user" && <small className="cell-sub">{text(data.clients.find((client) => client.id === text(campaign, "userId")), "name", "displayName") || text(campaign, "userId")}</small>}{text(campaign, "target") === "users" && <small className="cell-sub">{Array.isArray(campaign.userIds) ? `${(campaign.userIds as unknown[]).length} selected` : "Selected clients"}</small>}</td><td>{dateText(campaign.scheduledAt)}</td><td><Status value={text(campaign, "status")} enabled={text(campaign, "status") === "SCHEDULED"} /></td><td><div className="button-row">{canMutate && text(campaign, "status") === "SCHEDULED" && <button className="button button-danger-soft button-small" disabled={busy} onClick={() => { if (window.confirm("Cancel this scheduled notification?")) void runAction("cancelScheduledNotification", { campaignId: campaign.id }, "Scheduled notification cancelled.").catch(() => undefined); }}>Cancel</button>}{canMutate && text(campaign, "status") === "FAILED" && <button className="button button-soft button-small" disabled={busy} onClick={() => { if (window.confirm("Retry this failed campaign in about one minute?")) void runAction("retryScheduledNotification", { campaignId: campaign.id }, "Failed campaign queued for retry.").catch(() => undefined); }}>Retry</button>}</div></td></tr>)}
          {data.scheduledNotifications.length === 0 && <EmptyRow colSpan={5} text={data.errors.scheduledNotifications || "No pending, processing, or failed scheduled campaigns."} />}
        </tbody></table></div>
      </Panel>
    </>;
  };
  const renderIntegrations = () => <>
    {title("Integrations & health", "Check live backend readiness and review partner API and webhook events.")}
    <div className="metric-grid metric-grid-4"><Metric icon="◉" label="Backend mode" value={labelStatus(data.health?.mode || "Unknown")} tone={data.health?.mode === "live" ? "green" : "orange"} /><Metric icon="⌘" label="Providers" value={coins(data.companies.length)} tone="blue" /><Metric icon="✓" label="Configured" value={coins(rows(data.health?.vendors).filter((vendor) => flag(vendor, "configured")).length)} tone="green" /><Metric icon="!" label="Webhook failures" value={coins(data.webhookLogs.filter((entry) => entry.success === false).length)} tone="red" /></div>
    <Panel title="Redcliffe pickup_hold webhook" subtitle="Register this project's secure callback with Redcliffe.">
      <div className="toolbar-row">
        <p>Redcliffe will send pickup_hold events to the live Cloud Function. The callback secret stays on the server.</p>
        {canMutate && <button className="button button-primary" disabled={busy} onClick={() => {
          void runAction("registerRedcliffeWebhook", {}, "Redcliffe webhook registration submitted.").then((value) => {
            const result = value && typeof value === "object" ? value as Record<string, unknown> : {};
            const verified = result.verified === true;
            setRedcliffeWebhookResult({ endpoint: String(result.endpoint ?? ""), verified });
            setNotice(verified
              ? "Redcliffe accepted and confirmed the pickup_hold webhook."
              : "Redcliffe accepted the webhook; its list endpoint has not confirmed it yet.");
          }).catch(() => undefined);
        }}>{busy ? "Registering…" : "Register pickup_hold webhook"}</button>}
      </div>
      {redcliffeWebhookResult && <div className={redcliffeWebhookResult.verified ? "security-note" : "data-warning"}>
        <span>{redcliffeWebhookResult.verified ? "✓" : "!"}</span>
        <div><strong>{redcliffeWebhookResult.verified ? "Webhook confirmed" : "Registration accepted; confirmation pending"}</strong>
          {redcliffeWebhookResult.endpoint && <p>Callback: <code>{redcliffeWebhookResult.endpoint}</code></p>}
          <p>Event: pickup_hold</p>
        </div>
      </div>}
    </Panel>
    <Panel title="API health checks" subtitle="The backend never exposes provider secrets"><HealthList vendors={rows(data.health?.vendors)} errors={data.errors} /></Panel>
    <Panel title="Latest API and webhook events" subtitle={`${data.webhookLogs.length} recent event records`}><WebhookTable logs={data.webhookLogs.slice(0, 40)} /></Panel>
  </>;

  const renderActivity = () => <>
    {title("Logs & audit", "Review the wallet ledger, administrator actions, and partner callback history.")}
    <div className="segmented"><button className={activityTab === "audit" ? "selected" : ""} onClick={() => setActivityTab("audit")}>Admin audit <span>{data.auditLogs.length}</span></button><button className={activityTab === "api" ? "selected" : ""} onClick={() => setActivityTab("api")}>API & webhooks <span>{data.webhookLogs.length}</span></button><button className={activityTab === "wallet" ? "selected" : ""} onClick={() => setActivityTab("wallet")}>Wallet ledger <span>{data.ledger.length}</span></button></div>
    <Panel title={activityTab === "audit" ? "Audit events" : activityTab === "api" ? "Integration events" : "Wallet transactions"} subtitle="Latest records loaded from Firestore">
      {activityTab === "audit" ? <AuditTable logs={data.auditLogs} /> : activityTab === "api" ? <WebhookTable logs={data.webhookLogs} /> : <LedgerTable entries={data.ledger} clients={data.clients} />}
    </Panel>
  </>;

  const renderAdmins = () => <>
    {title("Admin access", "Review active admin accounts and role assignments. No passwords are loaded or displayed.")}
    <div className="security-note"><span>◇</span><div><strong>Account credentials stay private</strong><p>This panel reads admin profile fields only. Passwords are never requested or shown.</p></div></div>
    <Panel title="Admin accounts" subtitle={`${data.admins.length} live admin records`}>
      <div className="table-wrap"><table><thead><tr><th>Admin</th><th>Role</th><th>Active</th><th>Last login</th>{admin.role === "super_admin" && <th>Update role</th>}</tr></thead><tbody>
        {data.admins.map((user) => <tr key={user.id}><td><div className="person-cell"><span className="avatar small-avatar">{initials(text(user, "name", "email"))}</span><span><strong>{text(user, "name", "displayName") || "Admin"}</strong><small>{text(user, "email") || user.id}</small></span></div></td><td><span className="role-badge">{labelStatus(text(user, "role") || "super admin")}</span></td><td><Status value={flag(user, "active", true) ? "Active" : "Disabled"} enabled={flag(user, "active", true)} /></td><td>{dateText(user.lastLoginAt)}</td></tr>)}
        {data.admins.length === 0 && <EmptyRow colSpan={4} text={data.errors.admins || "No admin records were returned."} />}
      </tbody></table></div>
    </Panel>
  </>;

  const renderReports = () => <>
    {title("Reports & exports", "Export current live data for finance, operations, clients, wallets, and audit review.")}
    <div className="report-grid">
      <ReportCard title="Clients & wallets" detail={`${data.clients.length} clients · all three balances`} onClick={() => downloadCsv("clients_wallets.csv", ["Client UID", "Name", "Email", "Phone", "Total RHS Credit", ...walletOptions.map((wallet) => wallet.label)], data.clients.map((client) => [client.id, text(client, "name", "displayName"), text(client, "email"), text(client, "phone", "phoneNumber"), walletOptions.reduce((sum, wallet) => sum + number(client, wallet.key), 0), ...walletOptions.map((wallet) => number(client, wallet.key))]))} />
      <ReportCard title="Orders & revenue" detail={`${data.orders.length} orders · amounts and statuses`} onClick={() => downloadCsv("orders.csv", ["orderId", "orderNumber", "customer", "phone", "provider", "product", "amountPaise", "commissionPaise", "orderStatus", "paymentStatus", "createdAt"], data.orders.map((order) => [order.id, text(order, "orderNumber"), text(order, "customerName"), text(order, "customerPhone"), text(order, "companyName"), text(order, "productName"), number(order, "amountPaise"), number(order, "commissionPaise"), text(order, "orderStatus"), text(order, "paymentStatus"), text(order, "createdAt")]))} />
      <ReportCard title="Wallet ledger" detail={`${data.ledger.length} recent transactions`} onClick={() => downloadCsv("credit_ledger.csv", ["createdAt", "userId", "walletType", "type", "amount", "balanceAfter", "description", "adminName"], data.ledger.map((entry) => [text(entry, "createdAt"), text(entry, "userId"), text(entry, "walletType"), text(entry, "type"), number(entry, "amount"), number(entry, "balanceAfter"), text(entry, "description"), text(entry, "adminName")]))} />
      <ReportCard title="Audit activity" detail={`${data.auditLogs.length} admin actions`} onClick={() => downloadCsv("audit_logs.csv", ["timestamp", "adminName", "role", "action", "entityType", "entityId", "summary"], data.auditLogs.map((entry) => [text(entry, "timestamp"), text(entry, "adminName"), text(entry, "role"), text(entry, "action"), text(entry, "entityType"), text(entry, "entityId"), text(entry, "summary")]))} />
      <ReportCard title="Provider catalog" detail={`${data.products.length} catalog records`} onClick={() => downloadCsv("catalog.csv", ["id", "name", "provider", "type", "price", "status"], data.products.map((item) => [item.id, text(item, "name", "title"), text(item, "companyName", "vendorId"), text(item, "type", "category"), number(item, "pricePaise") / 100 || number(item, "price"), text(item, "status")]))} />
      <ReportCard title="Settlement batches" detail={`${data.settlements.length} settlement records`} onClick={() => downloadCsv("settlements.csv", ["id", "provider", "period", "status", "grossPaise", "commissionPaise", "netPaise"], data.settlements.map((item) => [item.id, text(item, "companyName", "providerName", "companyId"), text(item, "period", "cycle"), text(item, "status"), number(item, "grossPaise"), number(item, "commissionPaise"), number(item, "netPaise", "payablePaise")]))} />
    </div>
  </>;

  const pages: Record<Section, () => ReactNode> = {
    overview: renderOverview, orders: renderOrders, clients: renderClients, phoneLogin: renderPhoneLogin, consultations: renderConsultations, support: renderSupport,
    providers: renderProviders, finance: renderFinance, catalog: renderCatalog, integrations: renderIntegrations,
    activity: renderActivity, admins: renderAdmins, reports: renderReports, plans: renderPlans,
  };

  return <div className="admin-app">
    <aside className="sidebar">
      <div className="brand"><Image src="/logo.png" alt="Restore Health Services" width={42} height={42} priority /><span><strong>Restore Health</strong><small>ADMIN CONSOLE</small></span></div>
      <div className="workspace-switch"><span className="workspace-avatar">R</span><span><strong>RHS Operations</strong><small>Live workspace</small></span><span className="switch-chevron">⌄</span></div>
      <nav className="side-nav">{["Workspace", "Operations", "Finance", "Settings"].map((group) => <div className="nav-group" key={group}><div className="nav-caption">{group}</div>{navigation.filter((item) => item.group === group).map((item) => <button key={item.id} className={`nav-item ${section === item.id ? "active" : ""}`} onClick={() => { setSection(item.id); setSearch(""); }}><span className="nav-symbol">{item.symbol}</span><span>{item.label}</span>{item.id === "clients" && pendingFamilyRequestCount > 0 && <span className="nav-count">{pendingFamilyRequestCount}</span>}{item.id === "orders" && totals.pendingOrders > 0 && <span className="nav-count">{totals.pendingOrders}</span>}</button>)}</div>)}</nav>
      <div className="sidebar-bottom"><div className="live-connection"><span className="live-dot" /><span><strong>Connected</strong><small>{lastUpdated ? `Updated ${new Date(lastUpdated).toLocaleTimeString()}` : "Syncing live data"}</small></span><button className="icon-button" title="Refresh data" onClick={() => void loadData()} disabled={dataLoading}>↻</button></div><div className="admin-user"><span className="avatar">{initials(admin.name || admin.email)}</span><span><strong>{admin.name || "Admin"}</strong><small>{labelStatus(admin.role)}</small></span><button className="icon-button" title="Sign out" onClick={() => void logout()}>⇥</button></div></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="breadcrumb"><span>Restore Health</span><span>/</span><strong>{activeLabel}</strong></div><div className="topbar-actions"><label className="global-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search this section..." /><kbd>⌘ K</kbd></label><button className="icon-button top-icon" title="Refresh live data" onClick={() => void loadData()} disabled={dataLoading}><span className={dataLoading ? "spin" : ""}>↻</span></button><span className="top-avatar">{initials(admin.name || admin.email)}</span></div></header>
      <div className="page-content">
        {error && <div className="global-error"><span>!</span><div><strong>Action or connection issue</strong><p>{error}</p></div><button onClick={() => setError("")}>×</button></div>}
        {Object.entries(data.errors).length > 0 && <div className="partial-warning"><span>!</span><span>{Object.entries(data.errors).length} data source{Object.entries(data.errors).length === 1 ? "" : "s"} could not be loaded. Affected panels show the source error.</span><button onClick={() => void loadData()}>Retry</button></div>}
        {pages[section]()}
      </div>
      <footer className="footer-line"><span>Restore Health Services · Admin</span><span>Live data · Refreshes every 20 seconds</span></footer>
    </main>
    {selectedClient && <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedClientId(""); }}><aside className="client-drawer"><div className="drawer-head"><span className="eyebrow">CLIENT PROFILE</span><button className="icon-button" onClick={() => setSelectedClientId("")}>×</button></div><div className="drawer-person"><span className="avatar large-avatar">{initials(text(selectedClient, "name", "displayName", "email"))}</span><h2>{text(selectedClient, "name", "displayName") || "RHS member"}</h2><p>{text(selectedClient, "email") || "No email address"}</p><span className="subtle-id">{selectedClient.id}</span></div><div className="client-account-actions">{canManageLogins && <button className="button button-soft" disabled={busy} onClick={() => void runAction("setClientAccountActive", { userId: selectedClient.id, active: selectedClient.active === false }, selectedClient.active === false ? "Client account enabled." : "Client account disabled.").catch(() => undefined)}>{selectedClient.active === false ? "Enable account" : "Disable account"}</button>}{canDeleteClients && <button className="button button-danger" disabled={busy} onClick={() => deleteClient(selectedClient)}>Delete client</button>}</div><div className="detail-contact"><div><small>Phone</small><strong>{text(selectedClient, "phone", "phoneNumber") || "Not provided"}</strong></div><div><small>Email verified</small><strong>{flag(selectedClient, "emailVerified") ? "Yes" : "No"}</strong></div><div><small>Joined</small><strong>{dateText(selectedClient.createdAt)}</strong></div></div><div className="wallet-total-card"><span>Total RHS Credit</span><strong>{inr(walletOptions.reduce((sum, wallet) => sum + number(selectedClient, wallet.key), 0))}</strong><small>Sum of the three separate provider balances</small></div><div className="drawer-section"><div className="section-heading compact-heading"><div><h3>Provider RHS Credits</h3><p>Each provider balance is managed separately.</p></div></div>{walletOptions.map((wallet) => <div className="wallet-row" key={wallet.id}><span className={`wallet-icon ${wallet.color}`}>{wallet.icon}</span><span className="wallet-info"><strong>{wallet.label}</strong><small>1 RHS credit = INR 1</small></span><strong>{inr(number(selectedClient, wallet.key))}</strong>{canMutate && <button className="button button-small button-soft" onClick={() => setDialog({ kind: "credit", client: selectedClient, wallet: wallet.id })}>Add</button>}</div>)}</div><FamilyMemberReviewPanel client={selectedClient} requests={selectedClientFamilyRequests} canMutate={canMutate} busy={busy} onReview={(memberId, status) => { void runAction("reviewFamilyMember", { memberId, status }, status === "APPROVED" ? "Family member approved." : "Family member request rejected.").catch(() => undefined); }} /><div className="drawer-section"><div className="section-heading compact-heading"><div><h3>Home screen scores</h3><p>The two circles on the client&apos;s app home screen (0-100%).</p></div></div>{scoreOptions.map((score) => { const value = Math.min(100, Math.max(0, Math.round(number(selectedClient, score.key)))); const change = (delta: number) => void runAction("adjustScore", { userId: selectedClient.id, field: score.key, delta }, `${score.label} updated.`).catch(() => undefined); return <div className="wallet-row" key={score.key}><span className="wallet-icon green">{score.icon}</span><span className="wallet-info"><strong>{score.label}</strong><small>Shown as {value}% in the app</small></span><ExactScoreEditor value={value} busy={busy} canMutate={canMutate} onSave={(target) => change(target - value)} /></div>; })}</div><StaySecureTaskAdmin client={selectedClient} canMutate={canMutate} busy={busy} runAction={runAction} /><ClientPractoHistory clientId={selectedClient.id} /><div className="drawer-section"><div className="section-heading compact-heading"><div><h3>Recent wallet history</h3><p>Server ledger entries for this client.</p></div></div><LedgerTable entries={data.ledger.filter((entry) => text(entry, "userId") === selectedClient.id).slice(0, 8)} clients={data.clients} compact /></div><div className="drawer-section"><div className="section-heading compact-heading"><div><h3>Order history</h3><p>Orders matched by client UID or phone. Filter by date and search order details, partner ID, name, phone, or test.</p></div></div><OrderHistory orders={ordersForClient(selectedClient, data.orders)} compact busy={busy} onRefresh={(order) => void runAction("refreshOrder", { orderId: order.id }, "Provider order status refreshed.").catch(() => undefined)} /></div><div className="drawer-section"><div className="section-heading compact-heading"><div><h3>Saved addresses</h3><p>Client delivery details</p></div></div><AddressList addresses={selectedClient.savedAddresses} /></div></aside></div>}
    {dialog && <ActionDialog dialog={dialog} companies={data.companies} canMutate={canMutate} busy={busy} onClose={() => setDialog(null)} onSubmit={(action, values, message) => void runAction(action, values, message).catch(() => undefined)} />}
    {notice && <div className="toast"><span>✓</span>{notice}</div>}
  </div>;
}

function pendingFamilyCount(clientId: string, requests: Row[]) { return requests.filter((request) => text(request, "userId") === clientId && (text(request, "status") || "PENDING").toUpperCase() === "PENDING").length; }
function dateValue(value: unknown) { const result = new Date(String(value ?? "")).getTime(); return Number.isFinite(result) ? result : 0; }
function dateFromRow(row: Row, fields: string[]) {
  for (const field of fields) {
    if (dateValue(row[field])) return row[field];
  }
  return undefined;
}
function orderDateValue(order: Row) { return dateFromRow(order, ["createdAt", "createdAtTs", "placedAt", "timestamp"]); }
function orderTimestamp(order: Row) { return dateValue(orderDateValue(order)); }
function bookingDateValue(booking: Row) { return dateFromRow(booking, ["booked_at", "bookedAt", "createdAt", "createdAtTs", "timestamp"]); }
function bookingTimestamp(booking: Row) { return dateValue(bookingDateValue(booking)); }
function ordersForClient(client: Row, orders: Row[]) {
  const uid = client.id;
  const phone = text(client, "phone", "phoneNumber").replace(/\D/g, "").slice(-10);
  return orders.filter((order) => text(order, "userId") ? text(order, "userId") === uid : phone.length === 10 && orderPhone(order) === phone);
}
function bookingTransaction(booking: Row) { return text(booking, "partner_transaction_id", "partnerTransactionId", "transactionId", "id"); }
function downloadCsv(filename: string, header: string[], values: unknown[][]) {
  const escape = (value: unknown) => { const textValue = String(value ?? ""); return /[",\n]/.test(textValue) ? `"${textValue.replaceAll('"', '""')}"` : textValue; };
  const csv = [header, ...values].map((line) => line.map(escape).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob); const link = document.createElement("a");
  link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}

function Metric({ icon, label, value, note, tone = "blue" }: { icon: string; label: string; value: string; note?: string; tone?: string }) {
  return <article className="metric-card"><span className={`metric-icon ${tone}`}>{icon}</span><div className="metric-label">{label}</div><strong className="metric-value">{value}</strong>{note && <small>{note}</small>}</article>;
}
function Panel({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  return <section className="panel"><div className="panel-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>{children}</section>;
}
function Status({ value, enabled }: { value: string; enabled?: boolean }) {
  const lower = value.toLowerCase();
  const tone = enabled === false || lower.includes("down") || lower.includes("fail") || lower.includes("cancel") ? "danger" : lower.includes("pending") || lower.includes("degrad") || lower.includes("review") || lower.includes("unknown") ? "warning" : lower.includes("active") || lower.includes("healthy") || lower.includes("complete") || lower.includes("paid") || lower.includes("success") || enabled === true ? "success" : "neutral";
  return <span className={`status-pill ${tone}`}><i />{labelStatus(value || (enabled ? "Enabled" : "Not set"))}</span>;
}
function EmptyRow({ colSpan, text: message }: { colSpan: number; text: string }) { return <tr><td colSpan={colSpan}><div className="empty-state"><span>⌕</span><strong>{message}</strong></div></td></tr>; }
function EmptyText({ text: message }: { text: string }) { return <div className="empty-state"><span>⌕</span><strong>{message}</strong></div>; }
function EmptyCard({ title, detail }: { title: string; detail: string }) { return <div className="empty-card"><span>⌘</span><strong>{title}</strong><p>{detail}</p></div>; }

function OrderHistory({ orders, compact = false, canMutate = false, busy = false, onRefresh, onStatus, onRetry, onRefund }: { orders: Row[]; compact?: boolean; canMutate?: boolean; busy?: boolean; onRefresh?: (order: Row) => void; onStatus?: (order: Row) => void; onRetry?: (order: Row) => void; onRefund?: (order: Row) => void }) {
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter((order) => {
      const date = orderDateKey(order);
      if (fromDate && (!date || date < fromDate)) return false;
      if (toDate && (!date || date > toDate)) return false;
      return !term || searchableOrderText(order).includes(term);
    }).sort((a, b) => orderTimestamp(b) - orderTimestamp(a));
  }, [orders, search, fromDate, toDate]);
  const hasFilters = !!search || !!fromDate || !!toDate;
  return <>
    <div className="order-history-toolbar">
      <label className="order-history-search">Search orders<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Order details, partner ID, name, phone, test…" /></label>
      <label className="order-history-date">Order date from<input type="date" value={fromDate} max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)} /></label>
      <label className="order-history-date">Order date to<input type="date" value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} /></label>
      {hasFilters && <button className="text-button order-history-reset" onClick={() => { setSearch(""); setFromDate(""); setToDate(""); }}>Clear filters</button>}
    </div>
    <p className="order-history-count">Showing {filtered.length} of {orders.length} orders{hasFilters ? " matching these filters" : ""}.</p>
    <OrderTable orders={filtered} compact={compact} canMutate={canMutate} busy={busy} onRefresh={onRefresh} onStatus={onStatus} onRetry={onRetry} onRefund={onRefund} emptyMessage={hasFilters ? "No orders match this search and date range." : "No orders are available for this client."} />
  </>;
}

function searchableOrderText(order: Row) {
  const flatten = (value: unknown): string[] => {
    if (value == null) return [];
    if (Array.isArray(value)) return value.flatMap(flatten);
    if (typeof value === "object") return Object.values(value as Record<string, unknown>).flatMap(flatten);
    return typeof value === "string" || typeof value === "number" ? [String(value)] : [];
  };
  return flatten(order).join(" ").toLowerCase();
}

function orderDateKey(order: Row) {
  const timestamp = orderTimestamp(order);
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function OrderTable({ orders, compact = false, canMutate = false, busy = false, onRefresh, onStatus, onRetry, onRefund, emptyMessage = "No live orders match this view." }: { orders: Row[]; compact?: boolean; canMutate?: boolean; busy?: boolean; onRefresh?: (order: Row) => void; onStatus?: (order: Row) => void; onRetry?: (order: Row) => void; onRefund?: (order: Row) => void; emptyMessage?: string }) {
  const showActions = !!onRefresh || (!compact && canMutate);
  return <div className="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Provider / product</th><th>Amount</th><th>Status</th><th>Payment</th>{showActions && <th>Actions</th>}</tr></thead><tbody>
    {orders.map((order) => { const isThyrocare = text(order, "vendorId", "companyId", "companyCode").toLowerCase() === "thyrocare"; return <tr key={order.id}><td><strong>{text(order, "orderNumber") || order.id.slice(0, 10)}</strong><small className="cell-sub">{dateText(orderDateValue(order))}</small>{text(order, "partnerOrderId") && <small className="cell-sub">Partner ID: {text(order, "partnerOrderId")}</small>}</td><td>{text(order, "customerName") || "—"}<small className="cell-sub">{text(order, "customerPhone")}</small></td><td>{text(order, "companyName", "providerName", "vendorId", "companyId") || "—"}<small className="cell-sub">{text(order, "productName", "serviceName")}</small></td><td>{inr(number(order, "amountPaise") / 100)}</td><td><Status value={text(order, "orderStatus", "status") || "Unknown"} />{text(order, "partnerStatus") && <small className="cell-sub">Provider: {text(order, "partnerStatus")}</small>}</td><td>{text(order, "paymentStatus") ? <Status value={text(order, "paymentStatus")} /> : "—"}</td>{showActions && <td><div className="table-actions">{isThyrocare && onRefresh && text(order, "partnerOrderId") && <button className="text-button" disabled={busy} onClick={() => onRefresh(order)}>Check live</button>}{!compact && canMutate && <><button className="text-button" onClick={() => onStatus?.(order)}>Status</button><button className="text-button" onClick={() => onRetry?.(order)}>Retry</button><button className="text-button danger-link" onClick={() => onRefund?.(order)}>Refund</button></>}</div></td>}</tr>; })}
    {orders.length === 0 && <EmptyRow colSpan={showActions ? 7 : 6} text={emptyMessage} />}
  </tbody></table></div>;
}

function LedgerTable({ entries, clients, compact = false }: { entries: Row[]; clients: Row[]; compact?: boolean }) {
  const walletLabel = (value: string) => walletOptions.find((wallet) => wallet.id === value)?.label || "Provider not recorded";
  return <div className="table-wrap"><table><thead><tr><th>Client</th><th>Wallet</th><th>Transaction</th><th>Amount</th><th>Balance after</th>{!compact && <th>Admin</th>}<th>Date</th></tr></thead><tbody>
    {entries.map((entry) => { const client = clients.find((item) => item.id === text(entry, "userId")); return <tr key={entry.id}><td>{text(client, "name", "displayName") || text(entry, "userId") || "—"}</td><td>{walletLabel(text(entry, "walletType"))}</td><td>{labelStatus(text(entry, "type") || "Adjustment")}<small className="cell-sub">{text(entry, "description")}</small></td><td className={number(entry, "amount") < 0 ? "negative-amount" : "positive-amount"}>{number(entry, "amount") >= 0 ? "+" : "−"}{inr(Math.abs(number(entry, "amount")))}</td><td>{inr(number(entry, "balanceAfter"))}</td>{!compact && <td>{text(entry, "adminName") || "—"}</td>}<td>{dateText(entry.createdAt)}</td></tr>; })}
    {entries.length === 0 && <EmptyRow colSpan={compact ? 5 : 7} text="No wallet activity is recorded yet." />}
  </tbody></table></div>;
}

function AuditTable({ logs }: { logs: Row[] }) {
  return <div className="table-wrap"><table><thead><tr><th>Action</th><th>Admin</th><th>Entity</th><th>Summary</th><th>Time</th></tr></thead><tbody>{logs.map((log) => <tr key={log.id}><td><span className="event-code">{text(log, "action") || "ADMIN_EVENT"}</span></td><td>{text(log, "adminName", "actorName") || "—"}<small className="cell-sub">{text(log, "role")}</small></td><td>{labelStatus(text(log, "entityType") || "Record")}<small className="cell-sub">{text(log, "entityId")}</small></td><td className="summary-cell">{text(log, "summary") || "—"}</td><td>{dateText(log.timestamp || log.createdAt)}</td></tr>)}{logs.length === 0 && <EmptyRow colSpan={5} text="No audit events are available." />}</tbody></table></div>;
}

function WebhookTable({ logs }: { logs: Row[] }) {
  return <div className="table-wrap"><table><thead><tr><th>Provider</th><th>Direction / event</th><th>Endpoint</th><th>Result</th><th>Latency</th><th>Time</th></tr></thead><tbody>{logs.map((log) => <tr key={log.id}><td>{text(log, "companyName", "provider", "vendorId") || "—"}</td><td>{labelStatus(text(log, "direction") || "Event")}<small className="cell-sub">{text(log, "eventType", "event") || "—"}</small></td><td className="endpoint-cell">{text(log, "endpoint", "path") || "—"}</td><td><Status value={log.success === true ? "Success" : log.success === false ? "Failed" : text(log, "statusCode") || "Unknown"} enabled={log.success === true} /></td><td>{number(log, "durationMs")} ms</td><td>{dateText(log.timestamp || log.createdAt)}</td></tr>)}{logs.length === 0 && <EmptyRow colSpan={6} text="No API or webhook events are available." />}</tbody></table></div>;
}

function HealthList({ vendors, errors }: { vendors: Row[]; errors: Record<string, string> }) {
  if (errors.health) return <div className="data-warning">Health checks could not be loaded: {errors.health}</div>;
  if (vendors.length === 0) return <EmptyText text="The backend returned no provider health checks." />;
  return <div className="health-list">{vendors.map((vendor) => <div className="health-row" key={text(vendor, "id") || text(vendor, "name")}><span className={`health-mark ${flag(vendor, "configured") ? "configured" : "unconfigured"}`}>{flag(vendor, "configured") ? "✓" : "!"}</span><span className="health-name"><strong>{text(vendor, "name") || text(vendor, "id")}</strong><small>{Array.isArray(vendor.capabilities) ? vendor.capabilities.map(String).join(" · ") : "Provider connection"}</small></span><Status value={flag(vendor, "configured") ? "Configured" : "Not configured"} enabled={flag(vendor, "configured")} /></div>)}</div>;
}

function BookingTable({ bookings, onCheck, onPublish, onSetClient, canMutate, compact = false }: { bookings: Row[]; onCheck: (row: Row) => void; onPublish: (row: Row) => void; onSetClient: (row: Row) => void; canMutate: boolean; compact?: boolean }) {
  return <div className="table-wrap"><table><thead><tr><th>Transaction</th><th>Client</th><th>Doctor / specialty</th><th>Booking time</th><th>Provider status</th>{canMutate && <th>Actions</th>}</tr></thead><tbody>{bookings.map((booking) => <tr key={booking.id}><td><strong>{bookingTransaction(booking) || booking.id}</strong><small className="cell-sub">{text(booking, "client_id", "clientId", "userId")}</small></td><td>{text(booking, "client_name", "clientName", "customerName") || "—"}<small className="cell-sub">{text(booking, "client_phone", "clientPhone", "phone")}</small></td><td>{text(booking, "doctor_name", "doctorName") || "—"}<small className="cell-sub">{text(booking, "speciality", "specialty")}</small></td><td>{dateText(bookingDateValue(booking))}</td><td><Status value={text(booking, "client_status", "clientStatus", "status", "practo_status") || "Unknown"} /></td>{canMutate && <td><div className="table-actions"><button className="text-button" onClick={() => onCheck(booking)}>Check</button><button className="text-button" onClick={() => onPublish(booking)}>Publish</button>{!compact && <button className="text-button" onClick={() => onSetClient(booking)}>Set client status</button>}</div></td>}</tr>)}{bookings.length === 0 && <EmptyRow colSpan={canMutate ? 6 : 5} text="No Practo booking records are available." />}</tbody></table></div>;
}

function ConsultationTable({ consultations }: { consultations: Row[] }) {
  return <div className="table-wrap"><table><thead><tr><th>Consultation</th><th>Client</th><th>Doctor</th><th>Speciality</th><th>Status</th><th>Updated</th></tr></thead><tbody>{consultations.map((item) => <tr key={item.id}><td><strong>{text(item, "id", "consultationId", "partnerTransactionId")}</strong><small className="cell-sub">{text(item, "bookingId", "partner_transaction_id")}</small></td><td>{text(item, "clientName", "customerName", "name") || "—"}<small className="cell-sub">{text(item, "phone", "clientPhone")}</small></td><td>{text(item, "doctorName", "doctor_name") || "—"}</td><td>{text(item, "speciality", "specialty") || "—"}</td><td><Status value={text(item, "status", "consultationStatus") || "Unknown"} /></td><td>{dateText(item.updatedAt || item.createdAt || item.timestamp)}</td></tr>)}{consultations.length === 0 && <EmptyRow colSpan={6} text="No consultation records were returned." />}</tbody></table></div>;
}

function SettlementTable({ settlements, canFinance, onAction }: { settlements: Row[]; canFinance: boolean; onAction: (action: string, row: Row) => void }) {
  return <div className="table-wrap"><table><thead><tr><th>Provider</th><th>Period</th><th>Gross</th><th>Commission</th><th>Payable</th><th>Status</th><th>Mismatch</th>{canFinance && <th>Actions</th>}</tr></thead><tbody>{settlements.map((item) => <tr key={item.id}><td><strong>{text(item, "companyName", "providerName", "companyId") || "Provider"}</strong></td><td>{text(item, "period", "cycle", "batchName") || dateText(item.createdAt)}</td><td>{inr(number(item, "grossPaise") / 100)}</td><td>{inr(number(item, "commissionPaise") / 100)}</td><td>{inr(number(item, "netPaise", "payablePaise") / 100)}</td><td><Status value={text(item, "status") || "Pending"} /></td><td>{text(item, "mismatchNote") || "—"}</td>{canFinance && <td><div className="table-actions"><button className="text-button" onClick={() => onAction("approveSettlement", item)}>Approve</button><button className="text-button" onClick={() => onAction("markSettlementPaid", item)}>Mark paid</button>{text(item, "mismatchNote") && <button className="text-button" onClick={() => onAction("resolveSettlementMismatch", item)}>Resolve</button>}</div></td>}</tr>)}{settlements.length === 0 && <EmptyRow colSpan={canFinance ? 8 : 7} text="No settlement batches are available." />}</tbody></table></div>;
}

function ProviderRevenue({ orders, companies }: { orders: Row[]; companies: Row[] }) {
  if (companies.length === 0) return <EmptyText text="Provider totals will appear when live provider data is available." />;
  const values = companies.map((company) => { const companyOrders = orders.filter((order) => text(order, "companyId", "companyCode").toLowerCase() === company.id.toLowerCase() || text(order, "companyName").toLowerCase() === text(company, "name").toLowerCase()); return { name: text(company, "name") || company.id, count: companyOrders.length, amount: companyOrders.reduce((sum, order) => sum + number(order, "amountPaise"), 0) }; });
  const max = Math.max(1, ...values.map((value) => value.amount));
  return <div className="revenue-list">{values.map((item) => <div className="revenue-row" key={item.name}><div className="revenue-label"><span>{item.name}</span><strong>{inr(item.amount / 100)}</strong></div><div className="bar-track"><span style={{ width: `${Math.max(2, item.amount / max * 100)}%` }} /></div><small>{item.count} orders</small></div>)}</div>;
}

function AddressList({ addresses }: { addresses: unknown }) {
  if (!Array.isArray(addresses) || addresses.length === 0) return <EmptyText text="No saved addresses." />;
  return <div className="address-list">{addresses.map((address, index) => { const item = address as Record<string, unknown>; return <div key={index}><strong>{String(item.label || "Saved address")}</strong><p>{[item.line1, item.line2, item.landmark, item.city, item.state, item.pincode].filter(Boolean).map(String).join(", ")}</p></div>; })}</div>;
}

function ReportCard({ title, detail, onClick }: { title: string; detail: string; onClick: () => void }) {
  return <button className="report-card" onClick={onClick}><span className="report-icon">▥</span><span className="report-body"><strong>{title}</strong><small>{detail}</small></span><span className="report-download">↓</span></button>;
}

type PlanBenefitDraft = { title: string; limit: string; period: "plan" | "month" | "year" };
type PlanTemplateDraft = {
  planId?: string;
  name: string;
  description: string;
  pricePaise: number;
  validityDays: number;
  active: boolean;
  benefits: Array<{ title: string; limit: number; period: "plan" | "month" | "year" }>;
};

function PlanTemplateForm({ initialPlan, busy, onCancel, onSubmit }: {
  initialPlan: Row | null;
  busy: boolean;
  onCancel?: () => void;
  onSubmit: (draft: PlanTemplateDraft) => void;
}) {
  const initialBenefits: PlanBenefitDraft[] = Array.isArray(initialPlan?.benefits)
    ? (initialPlan.benefits as Array<Record<string, unknown>>).map((benefit) => ({
      title: String(benefit.title ?? ""), limit: String(benefit.limit ?? 1),
      period: ["month", "year", "plan"].includes(String(benefit.period)) ? benefit.period as PlanBenefitDraft["period"] : "plan",
    }))
    : [{ title: "", limit: "1", period: "plan" }];
  const [benefits, setBenefits] = useState<PlanBenefitDraft[]>(initialBenefits.length ? initialBenefits : [{ title: "", limit: "1", period: "plan" }]);

  return <form className="stack-form management-form" onSubmit={(event) => {
    event.preventDefault();
    const values = formObject(event.currentTarget);
    onSubmit({
      ...(initialPlan ? { planId: initialPlan.id } : {}),
      name: String(values.name ?? ""),
      description: String(values.description ?? ""),
      pricePaise: Math.round(Number(values.priceRupees) * 100),
      validityDays: Number(values.validityDays),
      active: values.active === "on",
      benefits: benefits.map((benefit) => ({ ...benefit, title: benefit.title.trim(), limit: Number(benefit.limit) })),
    });
  }}>
    <label>Plan name<input name="name" defaultValue={text(initialPlan, "name") || "Restore Health Services Plan 1"} minLength={2} maxLength={80} required /></label>
    <label>Client-facing description<textarea name="description" defaultValue={text(initialPlan, "description")} rows={3} maxLength={500} placeholder="Explain who this plan is for and what's included" /></label>
    <div className="form-grid"><label>Plan price (₹)<input name="priceRupees" type="number" min="0" step="0.01" defaultValue={number(initialPlan, "pricePaise") ? (number(initialPlan, "pricePaise") / 100).toFixed(2) : ""} required /></label><label>Default validity (days)<input name="validityDays" type="number" min="1" max="3650" defaultValue={number(initialPlan, "validityDays") || 365} required /></label></div>
    <div className="benefit-editor-heading"><div><strong>Included benefits</strong><small>These are shown on the client's plan card.</small></div><button type="button" className="button button-soft button-small" disabled={benefits.length >= 20} onClick={() => setBenefits((items) => [...items, { title: "", limit: "1", period: "plan" }])}>+ Add benefit</button></div>
    <div className="benefit-editor-list">{benefits.map((benefit, index) => <div className="benefit-editor-row" key={index}>
      <label>Benefit<input value={benefit.title} onChange={(event) => setBenefits((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item))} minLength={2} maxLength={80} placeholder="Teleconsultations" required /></label>
      <label>Count<input type="number" min="1" max="1000" value={benefit.limit} onChange={(event) => setBenefits((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, limit: event.target.value } : item))} required /></label>
      <label>Applies<select value={benefit.period} onChange={(event) => setBenefits((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, period: event.target.value as PlanBenefitDraft["period"] } : item))}><option value="plan">Per plan</option><option value="month">Per month</option><option value="year">Per year</option></select></label>
      <button type="button" className="benefit-remove" aria-label={`Remove benefit ${index + 1}`} disabled={benefits.length <= 1} onClick={() => setBenefits((items) => items.filter((_, itemIndex) => itemIndex !== index))}>×</button>
    </div>)}</div>
    <label className="confirm-check"><input name="active" type="checkbox" defaultChecked={initialPlan?.active !== false} /><span>Available to assign to new clients</span></label>
    <div className="plan-editor-actions">{onCancel && <button type="button" className="button button-soft" onClick={onCancel} disabled={busy}>Cancel edit</button>}<button className="button button-primary" disabled={busy}>{busy ? "Saving…" : initialPlan ? "Save plan changes" : "Create plan template"}</button></div>
  </form>;
}

function Modal({ title, subtitle, onClose, children, busy }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode; busy: boolean }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-label={title}><div className="modal-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button" onClick={onClose} disabled={busy}>×</button></div>{children}</section></div>;
}

function ActionDialog({ dialog, companies, canMutate, busy, onClose, onSubmit }: { dialog: Exclude<DialogState, null>; companies: Row[]; canMutate: boolean; busy: boolean; onClose: () => void; onSubmit: (action: string, values: Record<string, unknown>, message: string) => void }) {
  const handle = (action: string, message: string, fixed: Record<string, unknown> = {}) => (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); onSubmit(action, { ...formObject(event.currentTarget), ...fixed }, message); };
  if (dialog.kind === "newClient") return <Modal title="Add client" subtitle="Create the client ID after assigning their policy. Email/password and phone OTP sign-in will use this same account." onClose={onClose} busy={busy}>
    <form className="stack-form modal-form" onSubmit={handle("createClient", "Client account created. Email/password and phone OTP login are ready.")}>
      <label>Client name<input name="name" autoComplete="name" minLength={2} maxLength={80} required /></label>
      <div className="form-grid">
        <label>Date of birth<input name="dateOfBirth" type="date" max={localDateInput(new Date())} required /></label>
        <label>Gender<select name="gender" defaultValue="" required><option value="" disabled>Select gender</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option></select></label>
      </div>
      <label>Email<input name="email" type="email" autoComplete="email" maxLength={120} required /></label>
      <div className="form-grid">
        <label>Phone number<input name="phoneNumber" type="tel" inputMode="tel" autoComplete="tel" maxLength={20} placeholder="+91 98765 43210" required /></label>
        <label>Password<input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required /></label>
      </div>
      <div className="data-warning">The client can sign in with this email and password or request an OTP on this phone number.</div>
      <label className="confirmation-row"><input type="checkbox" name="confirmedPhoneOwnership" value="true" required /><span>I confirmed that the client controls this phone number and wants to use it for OTP sign-in.</span></label>
      <div className="modal-actions"><button className="button button-soft" type="button" onClick={onClose} disabled={busy}>Cancel</button><button className="button button-primary" type="submit" disabled={!canMutate || busy}>{busy ? "Creating account…" : "Create client ID"}</button></div>
    </form>
  </Modal>;
  if (dialog.kind === "phoneLogin") {
    const login = phoneLoginRecord(dialog.client);
    const phoneNumber = String(login.phoneNumber ?? text(dialog.client, "phone", "phoneNumber"));
    const submitPhoneLogin = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      onSubmit("setPhoneLogin", { ...formObject(event.currentTarget), userId: dialog.client.id, status: "APPROVED" }, "Phone number approved for Firebase OTP login.");
    };
    return <Modal title="Verify and approve phone" subtitle={`For ${text(dialog.client, "name", "displayName", "email") || "RHS member"}.`} onClose={onClose} busy={busy}>
      <form className="stack-form modal-form" onSubmit={submitPhoneLogin}>
        <label>Phone number<input name="phoneNumber" type="tel" inputMode="tel" autoComplete="tel" maxLength={20} defaultValue={phoneNumber} placeholder="+919876543210" required /></label>
        <div className="data-warning">This associates the number with this client&apos;s existing Firebase account. Firebase sends and verifies the OTP during the client&apos;s sign-in.</div>
        <label className="confirmation-row"><input type="checkbox" name="confirmedPhoneOwnership" value="true" required /><span>I confirmed with the client that they control this number and want to use it to sign in.</span></label>
        <div className="modal-actions"><button className="button button-soft" type="button" onClick={onClose} disabled={busy}>Cancel</button><button className="button button-primary" type="submit" disabled={!canMutate || busy}>{busy ? "Saving…" : "Verify & approve"}</button></div>
      </form>
    </Modal>;
  }
  if (dialog.kind === "credit") return <Modal title={`Add ${walletOptions.find((wallet) => wallet.id === dialog.wallet)?.label}`} subtitle={`For ${text(dialog.client, "name", "displayName", "email") || "RHS member"}. This credit is added only to the selected provider wallet.`} onClose={onClose} busy={busy}><form className="stack-form modal-form" onSubmit={handle("addCredits", "RHS credits added successfully.", { userId: dialog.client.id, walletType: dialog.wallet })}><div className="current-balance"><span>Current balance</span><strong>{inr(number(dialog.client, walletOptions.find((wallet) => wallet.id === dialog.wallet)?.key || ""))}</strong></div><label>Amount<input name="amount" type="number" min="1" max="1000000" step="1" placeholder="500" required /></label><label>Admin note <span className="optional">Optional</span><input name="note" maxLength={200} placeholder="Reason for this credit" /></label><div className="modal-actions"><button className="button button-soft" type="button" onClick={onClose} disabled={busy}>Cancel</button><button className="button button-primary" type="submit" disabled={!canMutate || busy}>{busy ? "Adding…" : "Add credits"}</button></div></form></Modal>;

  if (dialog.kind === "partner") return <Modal title="Add provider integration" subtitle="Credentials are sent to the backend and kept out of client-readable documents." onClose={onClose} busy={busy}><form className="stack-form modal-form" onSubmit={handle("addPartner", "Provider integration added.")}><div className="form-grid"><label>Provider name<input name="name" required minLength={2} placeholder="Provider name" /></label><label>Provider code<input name="code" required minLength={2} placeholder="provider_code" /></label></div><label>Tagline<input name="tagline" placeholder="Short provider description" /></label><label>API base URL<input name="baseUrl" type="url" required placeholder="https://api.example.com" /></label><div className="form-grid"><label>Authentication type<select name="authType" defaultValue="API_KEY_HEADER"><option value="API_KEY_HEADER">API key header</option><option value="BEARER">Bearer token</option><option value="BASIC">Basic authentication</option></select></label><label>Auth header<input name="authHeader" defaultValue="x-api-key" /></label></div><label>API key<input name="apiKey" type="password" autoComplete="off" required minLength={4} /></label><label>API secret <span className="optional">Optional</span><input name="apiSecret" type="password" autoComplete="off" /></label><label>Webhook secret <span className="optional">Optional</span><input name="webhookSecret" type="password" autoComplete="off" /></label><div className="modal-actions"><button className="button button-soft" type="button" onClick={onClose} disabled={busy}>Cancel</button><button className="button button-primary" type="submit" disabled={!canMutate || busy}>{busy ? "Saving securely…" : "Add provider"}</button></div></form></Modal>;

  if (dialog.kind === "manualOrder") {
    const submitManualOrder = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const values = formObject(event.currentTarget);
      const company = companies.find((item) => item.id === String(values.companyId));
      onSubmit("createManualOrder", {
        ...values,
        companyName: text(company, "name"),
        companyCode: text(company, "code"),
        amountPaise: Math.round(Number(values.amountRupees) * 100),
      }, "Manual order created.");
    };
    return <Modal title="Create manual order" subtitle="Creates a real order record in Firestore for operational follow-up." onClose={onClose} busy={busy}><form className="stack-form modal-form" onSubmit={submitManualOrder}><div className="form-grid"><label>Customer name<input name="customerName" required /></label><label>Phone<input name="customerPhone" required inputMode="tel" /></label></div><label>Customer city<input name="customerCity" /></label><label>Provider<select name="companyId" required defaultValue=""><option value="" disabled>Select provider</option>{companies.map((company) => <option key={company.id} value={company.id}>{text(company, "name") || company.id}</option>)}</select></label><label>Product or service<input name="productName" required /></label><label>Order amount (INR)<input name="amountRupees" type="number" min="0" step="0.01" required /></label><div className="modal-actions"><button className="button button-soft" type="button" onClick={onClose} disabled={busy}>Cancel</button><button className="button button-primary" type="submit" disabled={!canMutate || busy}>{busy ? "Creating…" : "Create order"}</button></div></form></Modal>;
  }

  if (dialog.kind === "orderStatus") return <Modal title="Update order status" subtitle={`Order ${text(dialog.order, "orderNumber") || dialog.order.id}`} onClose={onClose} busy={busy}><form className="stack-form modal-form" onSubmit={handle("setOrderStatus", "Order status updated.", { orderId: dialog.order.id })}><label>New status<select name="status" defaultValue={text(dialog.order, "orderStatus").toUpperCase() || "NEW"}>{["NEW", "PLACED", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "FAILED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"].map((status) => <option key={status}>{status}</option>)}</select></label><label>Reason or note<textarea name="note" minLength={3} maxLength={300} required placeholder="Explain why the order status is being changed" /></label><div className="modal-actions"><button className="button button-soft" type="button" onClick={onClose} disabled={busy}>Cancel</button><button className="button button-primary" type="submit" disabled={!canMutate || busy}>{busy ? "Updating…" : "Save status"}</button></div></form><div className="modal-bottom-action"><button className="text-button" disabled={busy} onClick={() => onSubmit("clearOrderStatus", { orderId: dialog.order.id }, "Status override cleared; provider updates resumed.")}>Clear manual override</button></div></Modal>;

  if (dialog.kind === "refund") return <Modal title="Request order refund" subtitle={`Order ${text(dialog.order, "orderNumber") || dialog.order.id}`} onClose={onClose} busy={busy}><form className="stack-form modal-form" onSubmit={handle("refundOrder", "Refund request sent to the workflow.", { orderId: dialog.order.id })}><div className="current-balance"><span>Order amount</span><strong>{inr(number(dialog.order, "amountPaise") / 100)}</strong></div><label>Refund reason<textarea name="reason" minLength={4} maxLength={300} required defaultValue="Customer cancellation request" /></label><div className="modal-actions"><button className="button button-soft" type="button" onClick={onClose} disabled={busy}>Cancel</button><button className="button button-danger" type="submit" disabled={!canMutate || busy}>{busy ? "Sending…" : "Request refund"}</button></div></form></Modal>;

  const booking = dialog.booking;
  return <Modal title="Set client consultation status" subtitle="This status is posted to the selected client's booking record." onClose={onClose} busy={busy}><form className="stack-form modal-form" onSubmit={handle("setClientStatus", "Client consultation status updated.", { clientId: text(booking, "client_id", "clientId", "userId"), transactionId: bookingTransaction(booking) })}><label>Consultation status<select name="status" defaultValue="PENDING">{["PENDING", "ALLOCATED", "PRESCRIPTION_SHARED", "COMPLETED", "CANCELLED", "FAILED"].map((status) => <option key={status}>{status}</option>)}</select></label><label>Admin note<textarea name="note" minLength={3} maxLength={300} required placeholder="Add a client-facing status note" /></label><label>Doctor name <span className="optional">Optional</span><input name="doctorName" /></label><label>Prescription link <span className="optional">Optional</span><input name="prescriptionLink" type="url" /></label><label>Cancellation reason <span className="optional">Optional</span><input name="cancellationReason" /></label><div className="modal-actions"><button className="button button-soft" type="button" onClick={onClose} disabled={busy}>Cancel</button><button className="button button-primary" type="submit" disabled={!canMutate || busy}>{busy ? "Updating…" : "Post client status"}</button></div></form></Modal>;
}
