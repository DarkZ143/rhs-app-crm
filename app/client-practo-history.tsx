"use client";

import { useEffect, useState } from "react";

type Row = Record<string, unknown> & { id: string };

function text(row: Row, key: string) {
  const value = row[key];
  return value === undefined || value === null ? "" : String(value).trim();
}

function dateText(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function linkValue(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item ?? "").trim()).filter(Boolean)
    : [];
}

export default function ClientPractoHistory({ clientId }: { clientId: string }) {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/admin/practo-consultations?clientId=${encodeURIComponent(clientId)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Could not load Practo consultations.");
        const received = payload.data?.items;
        setItems(Array.isArray(received)
          ? received.filter((item: unknown): item is Row =>
            !!item && typeof item === "object" && "id" in item)
          : []);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "Could not load Practo consultations.");
        setItems([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [clientId, refreshVersion]);

  return (
    <div className="drawer-section practo-profile-section">
      <div className="section-heading compact-heading">
        <div>
          <h3>Practo Consultations{!loading && !error ? ` (${items.length})` : ""}</h3>
          <p>Booking details and the latest Practo webhook update.</p>
        </div>
        <button
          className="icon-button"
          type="button"
          title="Refresh Practo consultation details"
          aria-label="Refresh Practo consultation details"
          disabled={loading}
          onClick={() => setRefreshVersion((version) => version + 1)}
        >
          <span className={loading ? "spin" : ""}>↻</span>
        </button>
      </div>

      {loading ? (
        <div className="practo-profile-message">Loading consultation details…</div>
      ) : error ? (
        <div className="practo-profile-error">{error}</div>
      ) : items.length === 0 ? (
        <div className="practo-profile-message">No Practo bookings found for this client.</div>
      ) : (
        <div className="practo-profile-list">
          {items.map((item) => {
            const doctor = text(item, "doctorName") || "Doctor not assigned yet";
            const category = text(item, "specialityName") || text(item, "specialityId") || "Category not recorded";
            const qualifications = stringList(item.doctorQualifications);
            const specializations = stringList(item.doctorSpecializations);
            const prescription = linkValue(text(item, "prescriptionDownloadLink"));
            const patientLink = linkValue(text(item, "patientVideoLink"));
            const status = text(item, "status") || "UNKNOWN";
            const statusTone = /cancel|fail|reject/i.test(status)
              ? "danger"
              : /pending|unknown|review/i.test(status)
                ? "warning"
                : "success";
            const duration = Number(item.sessionDuration);
            const patient = [
              text(item, "patientName"),
              text(item, "patientGender"),
              text(item, "patientAge") ? `${text(item, "patientAge")} yrs` : "",
            ].filter(Boolean).join(" · ");

            return (
              <article className="practo-profile-card" key={item.id}>
                <div className="practo-profile-heading">
                  <div>
                    <strong>{doctor}</strong>
                    <small>{category}{text(item, "consultationType") ? ` · ${text(item, "consultationType")}` : ""}</small>
                  </div>
                  <span className={`practo-profile-status ${statusTone}`}>{status.replaceAll("_", " ")}</span>
                </div>

                <div className="practo-profile-grid">
                  <div><small>Patient</small><strong>{patient || "—"}</strong></div>
                  {text(item, "patientPhone") && <div><small>Patient phone</small><strong>{text(item, "patientPhone")}</strong></div>}
                  <div><small>Booked</small><strong>{dateText(text(item, "bookedAt"))}</strong></div>
                  {text(item, "createdAt") && <div><small>Practo created</small><strong>{dateText(text(item, "createdAt"))}</strong></div>}
                  <div><small>Practo transaction</small><strong>{text(item, "transactionId") || text(item, "partnerTransactionId") || "—"}</strong></div>
                  <div><small>Client-visible status</small><strong>{text(item, "clientStatus") || "PENDING"}</strong></div>
                  {duration > 0 && <div><small>Session duration</small><strong>{duration} sec</strong></div>}
                  {text(item, "latestEventType") && <div><small>Latest event</small><strong>{text(item, "latestEventType")}</strong></div>}
                  {text(item, "lastWebhookReceivedAt") && <div><small>Webhook received</small><strong>{dateText(text(item, "lastWebhookReceivedAt"))}</strong></div>}
                  {text(item, "latestEventAt") && <div><small>Event time</small><strong>{dateText(text(item, "latestEventAt"))}</strong></div>}
                </div>

                {(text(item, "reason") || text(item, "cancellationReason") || text(item, "clientStatusNote")) && (
                  <div className="practo-profile-note">
                    {text(item, "reason") && <p><b>Reason:</b> {text(item, "reason")}</p>}
                    {text(item, "cancellationReason") && <p><b>Cancellation:</b> {text(item, "cancellationReason")}</p>}
                    {text(item, "clientStatusNote") && <p><b>Admin note:</b> {text(item, "clientStatusNote")}</p>}
                  </div>
                )}

                {(patientLink || prescription) && (
                  <div className="practo-profile-links">
                    {patientLink && <a className="button button-small button-soft" href={patientLink} target="_blank" rel="noreferrer">Open patient session</a>}
                    {prescription && <a className="button button-small button-soft" href={prescription} target="_blank" rel="noreferrer">Open prescription</a>}
                  </div>
                )}

                {(qualifications.length > 0 || specializations.length > 0 || text(item, "doctorJoinedAt") || text(item, "patientJoinedAt")) && (
                  <details className="practo-profile-extra">
                    <summary>Doctor credentials and session activity</summary>
                    {specializations.length > 0 && <p><b>Doctor specialties:</b> {specializations.join(" · ")}</p>}
                    {qualifications.length > 0 && <p><b>Qualifications:</b> {qualifications.join(" · ")}</p>}
                    {text(item, "patientJoinedAt") && <p><b>Patient joined:</b> {dateText(text(item, "patientJoinedAt"))}</p>}
                    {text(item, "patientLeftAt") && <p><b>Patient left:</b> {dateText(text(item, "patientLeftAt"))}</p>}
                    {text(item, "doctorJoinedAt") && <p><b>Doctor joined:</b> {dateText(text(item, "doctorJoinedAt"))}</p>}
                    {text(item, "doctorLeftAt") && <p><b>Doctor left:</b> {dateText(text(item, "doctorLeftAt"))}</p>}
                  </details>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
