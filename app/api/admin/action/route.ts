import { NextResponse } from "next/server";
import { callAdminApi, createDocument, getAdminSession, patchDocument } from "@/lib/firebase-rest-server";

type Body = Record<string, unknown>;
const text = (body: Body, key: string) => String(body[key] ?? "").trim();
const amount = (body: Body, key: string) => Number(body[key] ?? 0);

export async function POST(request: Request) {
  const session = await getAdminSession().catch(() => null);
  if (!session) return NextResponse.json({ error: "Admin session expired. Sign in again." }, { status: 401 });
  const body = await request.json().catch(() => ({})) as Body;
  const action = text(body, "action");
  const role = String(session.profile.role || "super_admin");
  const canMutate = role !== "read_only";
  const financeRole = role === "super_admin" || role === "finance_admin";
  const canManageLogins = ["super_admin", "operations_admin", "support_admin", "admin"].includes(role.toLowerCase());
  const actor = String(session.profile.name || session.profile.email || session.uid);
  const now = new Date().toISOString();

  const requireMutable = () => {
    if (!canMutate) throw new Error("Read-only admin accounts cannot make changes.");
  };
  const audit = (event: string, entityType: string, entityId: string, summary: string) =>
    createDocument("audit_logs", {
      adminUid: session.uid,
      adminName: actor,
      role,
      action: event,
      entityType,
      entityId,
      summary,
      timestamp: now,
    }, session.idToken);

  try {
    let result: unknown = { ok: true };
    switch (action) {
      case "addCredits": {
        requireMutable();
        const userId = text(body, "userId");
        const walletType = text(body, "walletType");
        const creditAmount = amount(body, "amount");
        if (!userId || !Number.isInteger(creditAmount) || creditAmount < 1 || creditAmount > 1_000_000) throw new Error("Enter a valid client and credit amount.");
        if (!["practo", "redcliffe", "thyrocare"].includes(walletType)) throw new Error("Select a valid provider wallet.");
        result = await callAdminApi("/admin/credits/adjust", session.idToken, {
          userId, amount: creditAmount, walletType, note: text(body, "note") || undefined,
        }, "POST");
        break;
      }
      case "adjustScore": {
        requireMutable();
        const userId = text(body, "userId");
        const field = text(body, "field");
        const delta = amount(body, "delta");
        if (!userId || !["staySecureScore", "healthScore"].includes(field)) throw new Error("Select a valid client score.");
        if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 100) throw new Error("Enter a valid score change.");
        result = await callAdminApi(`/admin/users/${encodeURIComponent(userId)}/scores`, session.idToken, { field, delta }, "POST");
        break;
      }
      case "setStaySecureTasks": {
        requireMutable();
        const userId = text(body, "userId");
        const values = body.completedTaskIds;
        const allowed = new Set([
          "redcliffe_cbc", "redcliffe_thyroid", "redcliffe_hba1c",
          "thyrocare_thyroid", "thyrocare_hba1c", "thyrocare_lipid", "thyrocare_vitamins",
          "practo_general_physician", "practo_dermatology", "practo_cardiology",
        ]);
        if (!userId || !Array.isArray(values) || values.length > allowed.size
          || values.some((value) => typeof value !== "string" || !allowed.has(value))
          || new Set(values).size !== values.length) {
          throw new Error("Select valid Stay Secure tracker activities.");
        }
        result = await callAdminApi(`/admin/users/${encodeURIComponent(userId)}/stay-secure-tasks`, session.idToken, {
          completedTaskIds: values,
        }, "POST");
        break;
      }
      case "setPhoneLogin": {
        requireMutable();
        if (!canManageLogins) throw new Error("Your admin role cannot manage user logins.");
        const userId = text(body, "userId");
        const status = text(body, "status").toUpperCase();
        const phoneNumber = text(body, "phoneNumber");
        if (!userId || !["APPROVED", "NOT_APPROVED", "DISABLED"].includes(status)) {
          throw new Error("Select a valid client and phone login status.");
        }
        if (status === "APPROVED" && (!phoneNumber || text(body, "confirmedPhoneOwnership") !== "true")) {
          throw new Error("Enter the number and confirm that the user controls it before approving OTP login.");
        }
        result = await callAdminApi(`/admin/users/${encodeURIComponent(userId)}/phone-login`, session.idToken, {
          ...(phoneNumber ? { phoneNumber } : {}), status,
        }, "POST");
        break;
      }
      case "setClientAccountActive": {
        requireMutable();
        if (!canManageLogins) throw new Error("Your admin role cannot manage client accounts.");
        const userId = text(body, "userId");
        if (!userId || typeof body.active !== "boolean") throw new Error("Choose a client and account status.");
        result = await callAdminApi(`/admin/users/${encodeURIComponent(userId)}/account-status`, session.idToken, {
          active: body.active,
        }, "POST");
        break;
      }
      case "reviewFamilyMember": {
        requireMutable();
        const memberId = text(body, "memberId");
        const status = text(body, "status").toUpperCase();
        const note = text(body, "note");
        if (!/^[A-Za-z0-9_-]{1,200}$/.test(memberId)) throw new Error("Select a valid family member request.");
        if (!["APPROVED", "REJECTED"].includes(status)) throw new Error("Choose approve or reject for this family member request.");
        if (note.length > 200) throw new Error("The review note must be 200 characters or fewer.");
        result = await callAdminApi(`/admin/family-members/${encodeURIComponent(memberId)}/review`, session.idToken, {
          status,
          ...(note ? { note } : {}),
        }, "POST");
        break;
      }
      case "deleteClient": {
        requireMutable();
        if (role.toLowerCase() !== "super_admin") throw new Error("Only a super admin can permanently delete a client.");
        const userId = text(body, "userId");
        if (!userId) throw new Error("Enter a client ID.");
        result = await callAdminApi(`/admin/users/${encodeURIComponent(userId)}`, session.idToken, undefined, "DELETE");
        break;
      }
      case "getCreditSettings": {
        result = await callAdminApi("/admin/settings/credits", session.idToken, undefined, "GET");
        break;
      }
      case "setPractoFee": {
        requireMutable();
        const fee = amount(body, "practoConsultFeeRupees");
        if (!Number.isInteger(fee) || fee < 1 || fee > 100_000) throw new Error("Enter a fee between 1 and 1,00,000.");
        result = await callAdminApi("/admin/settings/credits", session.idToken, { practoConsultFeeRupees: fee }, "POST");
        break;
      }
      case "setOrderStatus": {
        requireMutable();
        result = await callAdminApi(`/admin/orders/${encodeURIComponent(text(body, "orderId"))}/status`, session.idToken, {
          status: text(body, "status"), note: text(body, "note"),
        }, "POST");
        break;
      }
      case "clearOrderStatus": {
        requireMutable();
        result = await callAdminApi(`/admin/orders/${encodeURIComponent(text(body, "orderId"))}/status/clear-override`, session.idToken, {}, "POST");
        break;
      }
      case "checkPracto": {
        requireMutable();
        result = await callAdminApi(`/admin/practo-bookings/${encodeURIComponent(text(body, "transactionId"))}/check`, session.idToken, {}, "POST");
        break;
      }
      case "publishPracto": {
        requireMutable();
        result = await callAdminApi(`/admin/practo-bookings/${encodeURIComponent(text(body, "transactionId"))}/publish`, session.idToken, {}, "POST");
        break;
      }
      case "setClientStatus": {
        requireMutable();
        const clientId = text(body, "clientId");
        result = await callAdminApi(`/admin/clients/${encodeURIComponent(clientId)}/status`, session.idToken, {
          partnerTransactionId: text(body, "transactionId"),
          status: text(body, "status"),
          note: text(body, "note"),
          doctorName: text(body, "doctorName") || undefined,
          prescriptionLink: text(body, "prescriptionLink") || undefined,
          cancellationReason: text(body, "cancellationReason") || undefined,
        }, "POST");
        break;
      }
      case "replySupportTicket": {
        requireMutable();
        const ticketId = text(body, "ticketId");
        const reply = text(body, "reply");
        if (!ticketId || reply.length < 3 || reply.length > 2000) throw new Error("Enter a support ticket and a reply between 3 and 2,000 characters.");
        result = await callAdminApi(`/admin/lucky-ai/support-requests/${encodeURIComponent(ticketId)}/reply`, session.idToken, { reply }, "POST");
        break;
      }
      case "seedVendors": {
        requireMutable();
        result = await callAdminApi("/admin/vendors/seed", session.idToken, {}, "POST");
        break;
      }
      case "registerRedcliffeWebhook": {
        requireMutable();
        result = await callAdminApi("/admin/redcliffe/webhook/register", session.idToken, {}, "POST");
        break;
      }
      case "syncVendor": {
        requireMutable();
        result = await callAdminApi(`/admin/vendors/${encodeURIComponent(text(body, "vendorId"))}/sync`, session.idToken, {}, "POST");
        break;
      }
      case "setCatalogPrice": {
        requireMutable();
        const vendorId = text(body, "vendorId").toLowerCase();
        const itemId = text(body, "itemId");
        const specialityId = text(body, "specialityId");
        const customerPriceRupees = amount(body, "customerPriceRupees");
        if (!["practo", "redcliffe"].includes(vendorId) || !itemId) {
          throw new Error("Select a valid provider product or Practo doctor.");
        }
        if (!Number.isFinite(customerPriceRupees) || customerPriceRupees < 1 || customerPriceRupees > 100000) {
          throw new Error("Enter a customer price between ₹1 and ₹1,00,000.");
        }
        result = await callAdminApi("/admin/catalog-pricing", session.idToken, {
          vendorId,
          itemId,
          ...(specialityId ? { specialityId } : {}),
          customerPricePaise: Math.round(customerPriceRupees * 100),
        }, "POST");
        break;
      }
      case "setProviderApiRate": {
        requireMutable();
        const vendorId = text(body, "vendorId").toLowerCase();
        const itemId = text(body, "itemId");
        const providerApiRateRupees = amount(body, "providerApiRateRupees");
        if (vendorId !== "thyrocare" || !itemId) throw new Error("Select a Thyrocare product.");
        if (!Number.isFinite(providerApiRateRupees) || providerApiRateRupees < 1 || providerApiRateRupees > 100000) {
          throw new Error("Enter a provider API rate between ₹1 and ₹1,00,000.");
        }
        result = await callAdminApi("/admin/catalog-pricing", session.idToken, {
          vendorId,
          itemId,
          providerApiRatePaise: Math.round(providerApiRateRupees * 100),
        }, "POST");
        break;
      }
      case "saveMembershipPlan": {
        requireMutable();
        const benefits = Array.isArray(body.benefits) ? body.benefits : [];
        const planId = text(body, "planId");
        result = await callAdminApi(planId ? `/admin/membership-plans/${encodeURIComponent(planId)}` : "/admin/membership-plans", session.idToken, {
          name: text(body, "name"),
          description: text(body, "description"),
          pricePaise: amount(body, "pricePaise"),
          validityDays: amount(body, "validityDays"),
          active: body.active !== false,
          benefits,
        }, planId ? "PATCH" : "POST");
        break;
      }
      case "setUserPlan": {
        requireMutable();
        const userId = text(body, "userId");
        if (!userId) throw new Error("Select a client before assigning a plan.");
        result = await callAdminApi(`/admin/users/${encodeURIComponent(userId)}/plan`, session.idToken, {
          planId: text(body, "planId"),
          name: text(body, "name"),
          description: text(body, "description"),
          pricePaise: amount(body, "pricePaise"),
          startDate: text(body, "startDate"),
          expiryDate: text(body, "expiryDate"),
          paymentConfirmed: body.paymentConfirmed === true,
          paymentReference: text(body, "paymentReference"),
          paymentMethod: text(body, "paymentMethod") || "other",
          paymentAmountPaise: amount(body, "paymentAmountPaise"),
          adminNote: text(body, "adminNote"),
          benefits: Array.isArray(body.benefits) ? body.benefits : [],
        }, "POST");
        break;
      }
      case "deactivateUserPlan": {
        requireMutable();
        const userId = text(body, "userId");
        if (!userId) throw new Error("Select a client before changing plan status.");
        result = await callAdminApi(`/admin/users/${encodeURIComponent(userId)}/plan/deactivate`, session.idToken, {}, "POST");
        break;
      }
      case "sendNotification": {
        requireMutable();
        const target = text(body, "target");
        if (!["all", "user", "users", "active_plan", "no_active_plan"].includes(target)) throw new Error("Choose a valid notification audience.");
        result = await callAdminApi("/admin/notifications", session.idToken, {
          target,
          ...(target === "user" ? { userId: text(body, "userId") } : {}),
          title: text(body, "title"),
          body: text(body, "body"),
          type: text(body, "type") || "announcement",
          priority: text(body, "priority") || "normal",
          pushEnabled: body.pushEnabled !== false,
          userIds: Array.isArray(body.userIds) ? body.userIds.map((value) => String(value)) : [],
          actionRoute: text(body, "actionRoute"),
          actionLabel: text(body, "actionLabel"),
          ...(text(body, "scheduledAt") ? { scheduledAt: text(body, "scheduledAt") } : {}),
        }, "POST");
        break;
      }
      case "cancelScheduledNotification": {
        requireMutable();
        const campaignId = text(body, "campaignId");
        if (!campaignId) throw new Error("Select a scheduled campaign to cancel.");
        result = await callAdminApi(`/admin/notifications/scheduled/${encodeURIComponent(campaignId)}`, session.idToken, undefined, "DELETE");
        break;
      }
      case "retryScheduledNotification": {
        requireMutable();
        const campaignId = text(body, "campaignId");
        if (!campaignId) throw new Error("Select a failed campaign to retry.");
        result = await callAdminApi(`/admin/notifications/scheduled/${encodeURIComponent(campaignId)}/retry`, session.idToken, {}, "POST");
        break;
      }
      case "addPartner": {
        requireMutable();
        result = await callAdminApi("/admin/partners", session.idToken, {
          name: text(body, "name"),
          code: text(body, "code"),
          tagline: text(body, "tagline"),
          baseUrl: text(body, "baseUrl"),
          authType: text(body, "authType"),
          authHeader: text(body, "authHeader") || "x-api-key",
          apiKey: text(body, "apiKey"),
          apiSecret: text(body, "apiSecret"),
          webhookSecret: text(body, "webhookSecret"),
        }, "POST");
        break;
      }
      case "requestVendorSync": {
        requireMutable();
        const id = text(body, "vendorId");
        await patchDocument(`companies/${id}`, { syncRequestedAt: now, integrationStatus: "sync_requested" }, session.idToken);
        await audit("PARTNER_SYNC_REQUESTED", "company", id, "Partner sync requested from the admin web panel.");
        break;
      }
      case "toggleVendor": {
        requireMutable();
        const id = text(body, "vendorId");
        const enabled = body.enabled === true;
        await patchDocument(`companies/${id}`, { enabled, updatedAt: now }, session.idToken);
        await audit("PARTNER_ENABLED_UPDATED", "company", id, `Provider enabled set to ${enabled}.`);
        break;
      }
      case "retryOrder": {
        requireMutable();
        const id = text(body, "orderId");
        await patchDocument(`orders/${id}`, { retryRequestedAt: now, retryRequestedBy: "admin" }, session.idToken);
        await audit("PARTNER_ORDER_RETRY_REQUESTED", "order", id, "Partner retry requested from the admin web panel.");
        break;
      }
      case "refreshOrder": {
        const id = text(body, "orderId");
        if (!id) throw new Error("Select an order to refresh.");
        result = await callAdminApi(`/orders/${encodeURIComponent(id)}/refresh`, session.idToken, {}, "POST");
        await audit("PARTNER_ORDER_STATUS_REFRESHED", "order", id, "Provider order status checked from the admin web panel.");
        break;
      }
      case "refundOrder": {
        requireMutable();
        const id = text(body, "orderId");
        const reason = text(body, "reason");
        if (!reason) throw new Error("Enter a reason for the refund request.");
        await patchDocument(`orders/${id}`, { refundRequestedAt: now, refundRequestedBy: "admin", refundReason: reason }, session.idToken);
        await audit("REFUND_REQUESTED", "order", id, reason);
        break;
      }
      case "createManualOrder": {
        requireMutable();
        const customerName = text(body, "customerName");
        const customerPhone = text(body, "customerPhone");
        const companyId = text(body, "companyId");
        const companyName = text(body, "companyName");
        const productName = text(body, "productName");
        const amountPaise = amount(body, "amountPaise");
        if (!customerName || !customerPhone || !companyId || !productName || !Number.isInteger(amountPaise) || amountPaise < 0) throw new Error("Complete the required manual order fields.");
        const id = crypto.randomUUID();
        const formatted = `INR ${(amountPaise / 100).toFixed(2)}`;
        await createDocument("orders", {
          orderNumber: id,
          customerName,
          customerPhone,
          customerCity: text(body, "customerCity"),
          companyId,
          companyName,
          companyCode: text(body, "companyCode"),
          productName,
          amountPaise,
          amountFormatted: formatted,
          commissionRate: 0,
          commissionPaise: 0,
          commissionFormatted: "INR 0",
          partnerPayablePaise: amountPaise,
          partnerPayableFormatted: formatted,
          gateway: "MANUAL",
          paymentStatus: "PENDING",
          orderStatus: "NEW",
          partnerStatus: "PENDING",
          orchestrationSteps: [],
          notesCount: 0,
          dispatchRequestedAt: now,
          createdAt: now,
        }, session.idToken, id);
        await audit("MANUAL_ORDER_CREATED", "order", id, `Manual order created for ${customerName}.`);
        result = { id };
        break;
      }
      case "approveSettlement":
      case "markSettlementPaid":
      case "resolveSettlementMismatch": {
        requireMutable();
        if (!financeRole) throw new Error("Only finance admins can update settlements.");
        const id = text(body, "settlementId");
        const fields = action === "approveSettlement"
          ? { status: "APPROVED", dualSignOff: true, approvedAt: now }
          : action === "markSettlementPaid"
            ? { status: "PAID", dualSignOff: true, paidAt: now }
            : { status: "UNDER_REVIEW", mismatchNote: null, escalationId: null };
        await patchDocument(`settlements/${id}`, fields, session.idToken);
        await audit(action.toUpperCase(), "settlement", id, "Settlement updated from the admin web panel.");
        break;
      }
      default:
        return NextResponse.json({ error: "Unknown admin action." }, { status: 400 });
    }
    return NextResponse.json({ data: result, ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Admin action failed." }, { status: 400 });
  }
}
