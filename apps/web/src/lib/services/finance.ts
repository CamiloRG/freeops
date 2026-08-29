/**
 * Cuentas de cobro & invoices — app_spec.md § "API Contracts &
 * Integrations" → "9. Cuentas de cobro", "10. Invoices". Same `RlsTx` +
 * `userId` + typed-input shape as every other service (see
 * `@/lib/services/projects`/`@/lib/services/crm` for the closest existing
 * reference).
 *
 * Numbering: `CDC-{issueYear}-{seq}` / `INV-{issueYear}-{seq}`, `seq`
 * zero-padded to 4 digits, claimed atomically at CREATE time (not at
 * issue) from `users.next_cuenta_de_cobro_number` /
 * `users.next_invoice_number` via the exact `UPDATE ... SET x = x + 1
 * RETURNING x - 1` technique `@/lib/services/kanban`'s `createTask` uses
 * for `kanban_boards.next_task_number` — the row-level lock Postgres
 * takes for the duration of the UPDATE serializes concurrent claims on the
 * same user row, so two concurrent creates can never receive the same
 * number. Deliberately never resets across years (see
 * `packages/db/src/schema/identity.ts`'s doc comment on these columns) —
 * a simplicity/correctness tradeoff, not an oversight.
 *
 * Itemization: when `items` is present+non-empty, `amount` (cuenta de
 * cobro) / `amount` (invoice, pre-tax) is computed here from each item's
 * `quantity * unitAmount` — the same "stored rollup kept in sync by the
 * service layer" pattern `invoices.totalAmount` (amount + taxAmount)
 * already used before this stage. `lineTotal` itself is never stored.
 *
 * Issuing: `issueCuentaDeCobro`/`issueInvoice` gather everything the PDF
 * needs (freelancer profile, decrypted tax info, branding) and render the
 * PDF bytes, but do NOT touch R2 or flip `status` — that mirrors
 * `@/lib/services/resume`'s split (PDF rendering lives in the service,
 * the R2 upload + final DB write live in the Route Handler) exactly.
 * Callers must pair `issueCuentaDeCobro`/`issueInvoice` with
 * `finalizeCuentaDeCobroIssue`/`finalizeInvoiceIssue` — see
 * `app/api/v1/cuentas-de-cobro/[id]/issue/route.ts` for the full flow.
 */
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { cuentasDeCobro, invoices, users, type FinanceLineItem } from "@freeops/db/schema";
import type { RlsTx } from "@freeops/db/rls-client";
import { ApiError } from "@/lib/api/errors";
import { getOwnedProject } from "@/lib/services/projects";
import { getOrCreateProfile } from "@/lib/services/profile";
import { getOrCreateBranding } from "@/lib/services/branding";
import { getTaxInfoDecrypted } from "@/lib/services/tax-info";
import type {
  CuentaDeCobroCreateInput,
  CuentaDeCobroUpdateInput,
  FinanceLineItemInput,
  InvoiceCreateInput,
  InvoiceUpdateInput,
} from "@/lib/validation/finance";
import {
  renderCuentaDeCobroPdf,
  renderInvoicePdf,
  type FinancePdfClient,
  type FinancePdfFreelancer,
} from "@/lib/services/finance-pdf";

// --- Shared helpers --------------------------------------------------------

function computeItemsAmount(items: FinanceLineItemInput[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitAmount, 0);
}

function toMoneyString(value: number): string {
  return value.toFixed(2);
}

/** Race-safe numbering claim — see this file's doc comment for the technique. */
async function claimCuentaDeCobroNumber(tx: RlsTx, userId: string, issueDate: string): Promise<string> {
  const [claimed] = await tx
    .update(users)
    .set({ nextCuentaDeCobroNumber: sql`${users.nextCuentaDeCobroNumber} + 1` })
    .where(eq(users.id, userId))
    .returning({ seq: sql<number>`${users.nextCuentaDeCobroNumber} - 1` });
  const year = new Date(`${issueDate}T00:00:00`).getFullYear();
  return `CDC-${year}-${String(claimed.seq).padStart(4, "0")}`;
}

async function claimInvoiceNumber(tx: RlsTx, userId: string, issueDate: string): Promise<string> {
  const [claimed] = await tx
    .update(users)
    .set({ nextInvoiceNumber: sql`${users.nextInvoiceNumber} + 1` })
    .where(eq(users.id, userId))
    .returning({ seq: sql<number>`${users.nextInvoiceNumber} - 1` });
  const year = new Date(`${issueDate}T00:00:00`).getFullYear();
  return `INV-${year}-${String(claimed.seq).padStart(4, "0")}`;
}

async function assertOwnedProjectIfProvided(tx: RlsTx, userId: string, projectId?: string | null) {
  if (!projectId) return;
  const project = await getOwnedProject(tx, userId, projectId);
  if (!project) {
    throw new ApiError("VALIDATION_ERROR", "El proyecto indicado no existe o no te pertenece.");
  }
}

/** Gathers the freelancer's own branding/tax-id for the PDF header — throws a clear 422 if tax info hasn't been filled in yet (needed on every generated document). */
async function buildFreelancerPdfContext(
  tx: RlsTx,
  userId: string
): Promise<{ freelancer: FinancePdfFreelancer; logoFileKey: string | null }> {
  const [profile, taxInfo, branding] = await Promise.all([
    getOrCreateProfile(tx, userId),
    getTaxInfoDecrypted(tx, userId),
    getOrCreateBranding(tx, userId),
  ]);
  if (!taxInfo) {
    throw new ApiError(
      "UNPROCESSABLE_ENTITY",
      "Completa tu información tributaria (Personal / Info. Tributaria) antes de emitir documentos."
    );
  }
  return {
    freelancer: { fullName: profile.fullName, taxIdType: taxInfo.taxIdType, taxIdNumber: taxInfo.taxIdNumber },
    logoFileKey: branding.logoFileKey,
  };
}

function toPdfClient(row: { clientName: string; clientTaxId: string | null }): FinancePdfClient {
  return { clientName: row.clientName, clientTaxId: row.clientTaxId };
}

function toPdfItems(items: unknown): FinanceLineItem[] | null {
  return Array.isArray(items) && items.length > 0 ? (items as FinanceLineItem[]) : null;
}

// --- Cuentas de cobro --------------------------------------------------

export async function listCuentasDeCobro(
  tx: RlsTx,
  userId: string,
  filters: { status?: string; projectId?: string } = {}
) {
  const conditions = [eq(cuentasDeCobro.userId, userId), isNull(cuentasDeCobro.deletedAt)];
  if (filters.status) conditions.push(eq(cuentasDeCobro.status, filters.status));
  if (filters.projectId) conditions.push(eq(cuentasDeCobro.projectId, filters.projectId));
  return tx.query.cuentasDeCobro.findMany({
    where: and(...conditions),
    orderBy: [desc(cuentasDeCobro.createdAt)],
  });
}

/** Returns the row only if it belongs to `userId` — RLS also enforces this; this is the 404-vs-403 existence check every other service uses. */
export async function getOwnedCuentaDeCobro(tx: RlsTx, userId: string, id: string) {
  return tx.query.cuentasDeCobro.findFirst({
    where: and(eq(cuentasDeCobro.id, id), eq(cuentasDeCobro.userId, userId), isNull(cuentasDeCobro.deletedAt)),
  });
}

export async function createCuentaDeCobro(tx: RlsTx, userId: string, input: CuentaDeCobroCreateInput) {
  await assertOwnedProjectIfProvided(tx, userId, input.projectId);

  const items = input.items?.length ? input.items : null;
  const amount = items ? computeItemsAmount(items) : input.amount!;
  const number = await claimCuentaDeCobroNumber(tx, userId, input.issueDate);

  const [created] = await tx
    .insert(cuentasDeCobro)
    .values({
      userId,
      projectId: input.projectId || null,
      number,
      clientName: input.clientName,
      clientTaxId: input.clientTaxId || null,
      concept: input.concept,
      amount: toMoneyString(amount),
      items,
      currency: input.currency ?? "COP",
      issueDate: input.issueDate,
      dueDate: input.dueDate,
      requiresWithholdingCertificate: input.requiresWithholdingCertificate ?? false,
    })
    .returning();
  return created;
}

/** Only while `status = "draft"` — throws `ApiError("UNPROCESSABLE_ENTITY", ...)` otherwise, per spec. Returns `null` if not found/not owned. */
export async function updateCuentaDeCobro(tx: RlsTx, userId: string, id: string, input: CuentaDeCobroUpdateInput) {
  const existing = await getOwnedCuentaDeCobro(tx, userId, id);
  if (!existing) return null;
  if (existing.status !== "draft") {
    throw new ApiError("UNPROCESSABLE_ENTITY", "Solo se pueden editar cuentas de cobro en borrador.");
  }
  if (input.projectId !== undefined) await assertOwnedProjectIfProvided(tx, userId, input.projectId);

  const patch: Partial<typeof cuentasDeCobro.$inferInsert> = { updatedAt: new Date() };
  if (input.projectId !== undefined) patch.projectId = input.projectId || null;
  if (input.clientName !== undefined) patch.clientName = input.clientName;
  if (input.clientTaxId !== undefined) patch.clientTaxId = input.clientTaxId || null;
  if (input.concept !== undefined) patch.concept = input.concept;
  if (input.currency !== undefined) patch.currency = input.currency;
  if (input.issueDate !== undefined) patch.issueDate = input.issueDate;
  if (input.dueDate !== undefined) patch.dueDate = input.dueDate;
  if (input.requiresWithholdingCertificate !== undefined) {
    patch.requiresWithholdingCertificate = input.requiresWithholdingCertificate;
  }

  if (input.items !== undefined) {
    const items = input.items?.length ? input.items : null;
    patch.items = items;
    patch.amount = toMoneyString(items ? computeItemsAmount(items) : (input.amount ?? Number(existing.amount)));
  } else if (input.amount !== undefined) {
    patch.amount = toMoneyString(input.amount);
  }

  const [updated] = await tx.update(cuentasDeCobro).set(patch).where(eq(cuentasDeCobro.id, id)).returning();
  return updated;
}

export async function softDeleteCuentaDeCobro(tx: RlsTx, id: string) {
  const [updated] = await tx
    .update(cuentasDeCobro)
    .set({ deletedAt: new Date() })
    .where(eq(cuentasDeCobro.id, id))
    .returning();
  return updated;
}

/** Gathers PDF context + renders the PDF bytes. Does NOT touch R2 or flip `status` — see this file's doc comment. Returns `null` if not found/owned. */
export async function issueCuentaDeCobro(tx: RlsTx, userId: string, id: string) {
  const cdc = await getOwnedCuentaDeCobro(tx, userId, id);
  if (!cdc) return null;
  if (cdc.status !== "draft") {
    throw new ApiError("UNPROCESSABLE_ENTITY", "Solo se pueden emitir cuentas de cobro en borrador.");
  }

  const { freelancer, logoFileKey } = await buildFreelancerPdfContext(tx, userId);
  const pdfBuffer = await renderCuentaDeCobroPdf({
    documentNumber: cdc.number,
    issueDate: cdc.issueDate,
    dueDate: cdc.dueDate,
    concept: cdc.concept,
    amount: Number(cdc.amount),
    currency: cdc.currency,
    items: toPdfItems(cdc.items),
    freelancer,
    client: toPdfClient(cdc),
    logoFileKey,
  });

  return { cdc, pdfBuffer };
}

export async function finalizeCuentaDeCobroIssue(tx: RlsTx, id: string, pdfFileKey: string) {
  const [updated] = await tx
    .update(cuentasDeCobro)
    .set({ status: "issued", pdfFileKey, updatedAt: new Date() })
    .where(eq(cuentasDeCobro.id, id))
    .returning();
  return updated;
}

// --- Invoices --------------------------------------------------------------

export async function listInvoices(tx: RlsTx, userId: string, filters: { status?: string; projectId?: string } = {}) {
  const conditions = [eq(invoices.userId, userId), isNull(invoices.deletedAt)];
  if (filters.status) conditions.push(eq(invoices.status, filters.status));
  if (filters.projectId) conditions.push(eq(invoices.projectId, filters.projectId));
  return tx.query.invoices.findMany({
    where: and(...conditions),
    orderBy: [desc(invoices.createdAt)],
  });
}

export async function getOwnedInvoice(tx: RlsTx, userId: string, id: string) {
  return tx.query.invoices.findFirst({
    where: and(eq(invoices.id, id), eq(invoices.userId, userId), isNull(invoices.deletedAt)),
  });
}

export async function createInvoice(tx: RlsTx, userId: string, input: InvoiceCreateInput) {
  await assertOwnedProjectIfProvided(tx, userId, input.projectId);

  const items = input.items?.length ? input.items : null;
  const amount = items ? computeItemsAmount(items) : input.amount!;
  const taxAmount = input.taxAmount ?? 0;
  const number = await claimInvoiceNumber(tx, userId, input.issueDate);

  const [created] = await tx
    .insert(invoices)
    .values({
      userId,
      projectId: input.projectId || null,
      cuentaDeCobroId: input.cuentaDeCobroId || null,
      number,
      clientName: input.clientName,
      clientTaxId: input.clientTaxId || null,
      amount: toMoneyString(amount),
      items,
      taxAmount: toMoneyString(taxAmount),
      totalAmount: toMoneyString(amount + taxAmount),
      currency: input.currency ?? "COP",
      issueDate: input.issueDate,
      dueDate: input.dueDate,
    })
    .returning();
  return created;
}

export async function updateInvoice(tx: RlsTx, userId: string, id: string, input: InvoiceUpdateInput) {
  const existing = await getOwnedInvoice(tx, userId, id);
  if (!existing) return null;
  if (existing.status !== "draft") {
    throw new ApiError("UNPROCESSABLE_ENTITY", "Solo se pueden editar facturas en borrador.");
  }
  if (input.projectId !== undefined) await assertOwnedProjectIfProvided(tx, userId, input.projectId);

  const patch: Partial<typeof invoices.$inferInsert> = { updatedAt: new Date() };
  if (input.projectId !== undefined) patch.projectId = input.projectId || null;
  if (input.cuentaDeCobroId !== undefined) patch.cuentaDeCobroId = input.cuentaDeCobroId || null;
  if (input.clientName !== undefined) patch.clientName = input.clientName;
  if (input.clientTaxId !== undefined) patch.clientTaxId = input.clientTaxId || null;
  if (input.currency !== undefined) patch.currency = input.currency;
  if (input.issueDate !== undefined) patch.issueDate = input.issueDate;
  if (input.dueDate !== undefined) patch.dueDate = input.dueDate;

  let nextAmount = Number(existing.amount);
  let nextItems: FinanceLineItem[] | null = (existing.items as FinanceLineItem[] | null) ?? null;
  if (input.items !== undefined) {
    nextItems = input.items?.length ? input.items : null;
    nextAmount = nextItems ? computeItemsAmount(nextItems) : (input.amount ?? nextAmount);
    patch.items = nextItems;
    patch.amount = toMoneyString(nextAmount);
  } else if (input.amount !== undefined) {
    nextAmount = input.amount;
    patch.amount = toMoneyString(nextAmount);
  }

  let nextTaxAmount = Number(existing.taxAmount);
  if (input.taxAmount !== undefined) {
    nextTaxAmount = input.taxAmount;
    patch.taxAmount = toMoneyString(nextTaxAmount);
  }

  if (input.amount !== undefined || input.items !== undefined || input.taxAmount !== undefined) {
    patch.totalAmount = toMoneyString(nextAmount + nextTaxAmount);
  }

  const [updated] = await tx.update(invoices).set(patch).where(eq(invoices.id, id)).returning();
  return updated;
}

export async function softDeleteInvoice(tx: RlsTx, id: string) {
  const [updated] = await tx.update(invoices).set({ deletedAt: new Date() }).where(eq(invoices.id, id)).returning();
  return updated;
}

export async function issueInvoice(tx: RlsTx, userId: string, id: string) {
  const invoice = await getOwnedInvoice(tx, userId, id);
  if (!invoice) return null;
  if (invoice.status !== "draft") {
    throw new ApiError("UNPROCESSABLE_ENTITY", "Solo se pueden emitir facturas en borrador.");
  }

  const { freelancer, logoFileKey } = await buildFreelancerPdfContext(tx, userId);
  const pdfBuffer = await renderInvoicePdf({
    documentNumber: invoice.number,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    amount: Number(invoice.amount),
    taxAmount: Number(invoice.taxAmount),
    totalAmount: Number(invoice.totalAmount),
    currency: invoice.currency,
    items: toPdfItems(invoice.items),
    freelancer,
    client: toPdfClient(invoice),
    logoFileKey,
  });

  return { invoice, pdfBuffer };
}

export async function finalizeInvoiceIssue(tx: RlsTx, id: string, pdfFileKey: string) {
  const [updated] = await tx
    .update(invoices)
    .set({ status: "issued", pdfFileKey, updatedAt: new Date() })
    .where(eq(invoices.id, id))
    .returning();
  return updated;
}
