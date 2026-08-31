/**
 * Payments / overdue tracking — app_spec.md § "API Contracts &
 * Integrations" → "11. Payments & overdue reminders". Same `RlsTx` +
 * `userId` + typed-input shape as every other service (see
 * `@/lib/services/finance` for the closest existing reference).
 *
 * Modeling decision: `payments` rows are NOT created at cuenta-de-cobro/
 * invoice creation time — they're created when a document is *issued*
 * (draft → issued), since only an issued document is a real receivable.
 * `createPendingPaymentForCuentaDeCobro`/`createPendingPaymentForInvoice`
 * are called from `finalizeCuentaDeCobroIssue`/`finalizeInvoiceIssue` in
 * `@/lib/services/finance`, inside the same transaction as the issue
 * finalize write — one atomic unit.
 *
 * No `relations()` definitions exist anywhere in this repo's Drizzle
 * schema, so pulling client/amount/due-date data from the parent document
 * always goes through an explicit `tx.select({...}).from(payments)
 * .leftJoin(...)` — the same manual-join convention
 * `@/lib/services/kanban`'s `getBoardForProject` already establishes.
 * `payments.cuentaDeCobroId`/`invoiceId` are mutually exclusive (DB CHECK
 * `num_nonnulls(...) = 1`), so exactly one of the two `leftJoin`s below
 * ever matches per row — never both, never neither.
 *
 * Overdue is computed at READ time, never stored/written back by a cron —
 * no scheduler exists until Phase 9, same "compute-at-read-time"
 * discipline already used for the project-overview screen's days-
 * remaining/contract-progress-bar. A payment's *effective* status is
 * `'overdue'` when its stored `status` is `pending`/`partial` AND the
 * parent document's `dueDate` is before today; otherwise the effective
 * status equals the stored status.
 *
 * `sendReminderNow` is deliberately NOT a real integration — Resend/
 * Twilio don't exist until Phase 9 (same precedent as Stage 2's disabled
 * "Enviar" button on cuentas de cobro/invoices). It only ever throws a
 * clear, honest "próximamente" `ApiError` — never a fake `{ sent: true }`.
 */
import { and, eq, inArray } from "drizzle-orm";
import { cuentasDeCobro, invoices, paymentReminders, payments } from "@freeops/db/schema";
import type { RlsTx } from "@freeops/db/rls-client";
import { ApiError } from "@/lib/api/errors";
import type { MarkPaymentPaidInput } from "@/lib/validation/payments";

function toMoneyString(value: number): string {
  return value.toFixed(2);
}

/** `YYYY-MM-DD` for today, in the same plain-date-string shape `date` columns use — string comparison is safe since both sides are ISO `YYYY-MM-DD`. */
function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(pastDateStr: string, todayStr: string): number {
  const past = new Date(`${pastDateStr}T00:00:00Z`).getTime();
  const today = new Date(`${todayStr}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((today - past) / (1000 * 60 * 60 * 24)));
}

export type PaymentEffectiveStatus = "pending" | "partial" | "paid" | "overdue" | "failed";

export interface PaymentJoinedRow {
  id: string;
  userId: string;
  cuentaDeCobroId: string | null;
  invoiceId: string | null;
  documentType: "cuenta_de_cobro" | "invoice";
  documentId: string;
  documentNumber: string;
  clientName: string;
  documentTotal: number;
  amountPaid: number | null;
  currency: string;
  dueDate: string;
  status: string; // raw stored status
  effectiveStatus: PaymentEffectiveStatus;
  daysOverdue: number | null;
  paidAt: Date | null;
  paymentMethod: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function baseJoinedSelect(tx: RlsTx) {
  return tx
    .select({
      id: payments.id,
      userId: payments.userId,
      cuentaDeCobroId: payments.cuentaDeCobroId,
      invoiceId: payments.invoiceId,
      amountPaid: payments.amountPaid,
      currency: payments.currency,
      status: payments.status,
      paidAt: payments.paidAt,
      paymentMethod: payments.paymentMethod,
      createdAt: payments.createdAt,
      updatedAt: payments.updatedAt,
      cdcNumber: cuentasDeCobro.number,
      cdcClientName: cuentasDeCobro.clientName,
      cdcAmount: cuentasDeCobro.amount,
      cdcDueDate: cuentasDeCobro.dueDate,
      invNumber: invoices.number,
      invClientName: invoices.clientName,
      invTotalAmount: invoices.totalAmount,
      invDueDate: invoices.dueDate,
    })
    .from(payments)
    .leftJoin(cuentasDeCobro, eq(payments.cuentaDeCobroId, cuentasDeCobro.id))
    .leftJoin(invoices, eq(payments.invoiceId, invoices.id));
}

type RawJoinedRow = Awaited<ReturnType<typeof baseJoinedSelect>>[number];

function shapeJoinedRow(row: RawJoinedRow, today: string): PaymentJoinedRow {
  const isInvoice = row.invoiceId != null;
  const documentType: "cuenta_de_cobro" | "invoice" = isInvoice ? "invoice" : "cuenta_de_cobro";
  const documentId = isInvoice ? row.invoiceId! : row.cuentaDeCobroId!;
  const documentNumber = (isInvoice ? row.invNumber : row.cdcNumber) ?? "";
  const clientName = (isInvoice ? row.invClientName : row.cdcClientName) ?? "";
  const documentTotal = Number((isInvoice ? row.invTotalAmount : row.cdcAmount) ?? 0);
  const dueDate = (isInvoice ? row.invDueDate : row.cdcDueDate) ?? "";
  const amountPaid = row.amountPaid != null ? Number(row.amountPaid) : null;

  const isOverdue = (row.status === "pending" || row.status === "partial") && dueDate !== "" && dueDate < today;
  const effectiveStatus: PaymentEffectiveStatus = isOverdue ? "overdue" : (row.status as PaymentEffectiveStatus);
  const daysOverdue = isOverdue ? daysBetween(dueDate, today) : null;

  return {
    id: row.id,
    userId: row.userId,
    cuentaDeCobroId: row.cuentaDeCobroId,
    invoiceId: row.invoiceId,
    documentType,
    documentId,
    documentNumber,
    clientName,
    documentTotal,
    amountPaid,
    currency: row.currency,
    dueDate,
    status: row.status,
    effectiveStatus,
    daysOverdue,
    paidAt: row.paidAt,
    paymentMethod: row.paymentMethod,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Reminders-sent count per payment, keyed by `paymentId` — will be 0 for everyone right now (no reminder-sending integration exists until Phase 9), which is correct/expected, not a bug. */
async function remindersSentByPaymentId(tx: RlsTx, paymentIds: string[]): Promise<Map<string, number>> {
  if (paymentIds.length === 0) return new Map();
  const rows = await tx
    .select({ paymentId: paymentReminders.paymentId, status: paymentReminders.status })
    .from(paymentReminders)
    .where(inArray(paymentReminders.paymentId, paymentIds));
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.paymentId, (map.get(row.paymentId) ?? 0) + 1);
  }
  return map;
}

/**
 * Lists this user's payments, joined against whichever parent document
 * (cuenta de cobro or invoice) applies. `statuses`, if provided, filters
 * against the READ-TIME-COMPUTED effective status (never the raw stored
 * column) — so `?status=overdue` correctly returns pending/partial
 * payments whose due date has passed. Ordered by due date ascending.
 */
export async function listPayments(
  tx: RlsTx,
  userId: string,
  statuses?: PaymentEffectiveStatus[]
): Promise<(PaymentJoinedRow & { remindersSent: number })[]> {
  const rows = await baseJoinedSelect(tx).where(eq(payments.userId, userId));
  const today = todayDateString();
  const shaped = rows.map((row) => shapeJoinedRow(row, today));

  const filtered =
    statuses && statuses.length > 0 ? shaped.filter((p) => statuses.includes(p.effectiveStatus)) : shaped;

  const remindersMap = await remindersSentByPaymentId(
    tx,
    filtered.map((p) => p.id)
  );

  return filtered
    .map((p) => ({ ...p, remindersSent: remindersMap.get(p.id) ?? 0 }))
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));
}

/** Returns the row only if it belongs to `userId` — RLS also enforces this; same 404-vs-403 existence check every other service uses. */
export async function getOwnedPayment(
  tx: RlsTx,
  userId: string,
  id: string
): Promise<(PaymentJoinedRow & { remindersSent: number }) | null> {
  const rows = await baseJoinedSelect(tx).where(and(eq(payments.id, id), eq(payments.userId, userId)));
  if (rows.length === 0) return null;
  const shaped = shapeJoinedRow(rows[0], todayDateString());
  const remindersMap = await remindersSentByPaymentId(tx, [shaped.id]);
  return { ...shaped, remindersSent: remindersMap.get(shaped.id) ?? 0 };
}

/** Inserts a `pending` payment row for a newly-issued cuenta de cobro — called from `finalizeCuentaDeCobroIssue`, same transaction. */
export async function createPendingPaymentForCuentaDeCobro(
  tx: RlsTx,
  userId: string,
  cdc: { id: string; currency: string }
) {
  const [created] = await tx
    .insert(payments)
    .values({
      userId,
      cuentaDeCobroId: cdc.id,
      invoiceId: null,
      currency: cdc.currency,
      status: "pending",
      amountPaid: null,
    })
    .returning();
  return created;
}

/** Same as `createPendingPaymentForCuentaDeCobro`, for a newly-issued invoice. */
export async function createPendingPaymentForInvoice(tx: RlsTx, userId: string, invoice: { id: string; currency: string }) {
  const [created] = await tx
    .insert(payments)
    .values({
      userId,
      cuentaDeCobroId: null,
      invoiceId: invoice.id,
      currency: invoice.currency,
      status: "pending",
      amountPaid: null,
    })
    .returning();
  return created;
}

/**
 * Marks a payment paid (or partial). 422s if already `paid`. `amountPaid`
 * defaults to the parent document's full total when `paidAmount` is
 * omitted — never trusts a client-submitted total, only ever compares
 * against the real stored document amount. When the payment flips to
 * `'paid'`, the parent document's own `status` column is updated to
 * `'paid'` too, keeping the two in sync (a `'partial'` payment leaves the
 * parent document's status at `'issued'`). Returns `null` if not
 * found/owned.
 */
export async function markPaymentPaid(tx: RlsTx, userId: string, id: string, input: MarkPaymentPaidInput) {
  const existing = await getOwnedPayment(tx, userId, id);
  if (!existing) return null;
  if (existing.status === "paid") {
    throw new ApiError("UNPROCESSABLE_ENTITY", "Este pago ya está registrado como pagado.");
  }

  const amountPaid = input.paidAmount ?? existing.documentTotal;
  const nextStatus = amountPaid >= existing.documentTotal ? "paid" : "partial";

  const [updated] = await tx
    .update(payments)
    .set({
      amountPaid: toMoneyString(amountPaid),
      status: nextStatus,
      paidAt: new Date(`${input.paidDate}T00:00:00`),
      updatedAt: new Date(),
    })
    .where(eq(payments.id, id))
    .returning();

  if (nextStatus === "paid") {
    if (existing.documentType === "cuenta_de_cobro") {
      await tx
        .update(cuentasDeCobro)
        .set({ status: "paid", updatedAt: new Date() })
        .where(eq(cuentasDeCobro.id, existing.documentId));
    } else {
      await tx.update(invoices).set({ status: "paid", updatedAt: new Date() }).where(eq(invoices.id, existing.documentId));
    }
  }

  return updated;
}

export interface OverdueDashboard {
  totalOverdueAmount: number;
  count: number;
  byClient: { clientName: string; amount: number; oldestDaysOverdue: number }[];
}

/** `GET /api/v1/payments/overdue-dashboard` — over payments whose effective status is `'overdue'` only. */
export async function getOverdueDashboard(tx: RlsTx, userId: string): Promise<OverdueDashboard> {
  const all = await listPayments(tx, userId, ["overdue"]);

  const totalOverdueAmount = all.reduce((sum, p) => sum + (p.documentTotal - (p.amountPaid ?? 0)), 0);

  const byClientMap = new Map<string, { amount: number; oldestDaysOverdue: number }>();
  for (const p of all) {
    const outstanding = p.documentTotal - (p.amountPaid ?? 0);
    const current = byClientMap.get(p.clientName) ?? { amount: 0, oldestDaysOverdue: 0 };
    current.amount += outstanding;
    current.oldestDaysOverdue = Math.max(current.oldestDaysOverdue, p.daysOverdue ?? 0);
    byClientMap.set(p.clientName, current);
  }

  const byClient = Array.from(byClientMap.entries())
    .map(([clientName, v]) => ({ clientName, amount: v.amount, oldestDaysOverdue: v.oldestDaysOverdue }))
    .sort((a, b) => b.amount - a.amount);

  return { totalOverdueAmount, count: all.length, byClient };
}

/**
 * `POST /api/v1/payments/:id/send-reminder-now` — NOT a real integration
 * (see this file's doc comment). Confirms the payment is owned (404 vs
 * 403 distinction, same as every other service) then always throws a
 * clear "próximamente" `ApiError` — never fakes a sent reminder.
 */
export async function sendReminderNow(tx: RlsTx, userId: string, id: string) {
  const existing = await getOwnedPayment(tx, userId, id);
  if (!existing) return null;
  throw new ApiError(
    "UNPROCESSABLE_ENTITY",
    "El envío de recordatorios próximamente — llega en la fase de notificaciones."
  );
}
