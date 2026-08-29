/**
 * Cuenta-de-cobro / invoice PDF rendering — app_spec.md § "API Contracts &
 * Integrations" → "9. Cuentas de cobro", "10. Invoices". Mirrors
 * `@/lib/services/resume`'s `renderResumePdf` structure (real `pdfkit`
 * document, no headless browser) — see that file's doc comment and
 * `app/api/v1/me/resume/export/route.ts` for the synchronous-generation-
 * behind-an-async-shaped-contract pattern this stage's `.../issue` Route
 * Handlers mirror exactly.
 *
 * Real financial document, not a marketing artifact — plain/legible
 * styling (black text, one accent color for the document-type label and
 * total, hairline rules), a real items table when itemized, Spanish copy
 * throughout. Amount formatting matches every other COP display in this
 * app (`Intl.NumberFormat("es-CO", { style: "currency", ... })`, same
 * formula `project-list.tsx`/`overview-dashboard.tsx`/etc. each already
 * duplicate locally — there is no single shared formatter file to import
 * from, so this follows that same established per-file convention rather
 * than inventing a new shared util).
 */
import PDFDocument from "pdfkit";
import { getFileBuffer } from "@/lib/storage/r2";

export interface FinancePdfFreelancer {
  fullName: string;
  taxIdType: string;
  taxIdNumber: string;
}

export interface FinancePdfClient {
  clientName: string;
  clientTaxId: string | null;
}

export interface FinancePdfLineItem {
  description: string;
  quantity: number;
  unitAmount: number;
}

interface FinancePdfBase {
  documentNumber: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  items: FinancePdfLineItem[] | null;
  freelancer: FinancePdfFreelancer;
  client: FinancePdfClient;
  /** `brandingAssets.logoFileKey`, if set — fetched and embedded, gracefully omitted on any failure (missing, unsupported format, etc.). */
  logoFileKey: string | null;
}

export interface CuentaDeCobroPdfInput extends FinancePdfBase {
  concept: string;
  amount: number;
}

export interface InvoicePdfInput extends FinancePdfBase {
  amount: number; // pre-tax
  taxAmount: number;
  totalAmount: number;
}

function formatCOP(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${Math.round(value).toLocaleString("es-CO")}`;
  }
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
}

/** Best-effort logo fetch — never throws; returns `null` on any failure (missing key, R2 error, unsupported format for `doc.image()`). */
async function tryFetchLogo(logoFileKey: string | null): Promise<Buffer | null> {
  if (!logoFileKey) return null;
  try {
    return await getFileBuffer("brandingLogos", logoFileKey);
  } catch {
    return null;
  }
}

function drawHeader(
  doc: PDFKit.PDFDocument,
  params: { title: string; documentNumber: string; freelancer: FinancePdfFreelancer; logoBuffer: Buffer | null }
) {
  const { title, documentNumber, freelancer, logoBuffer } = params;
  const left = doc.page.margins.left;
  const top = doc.page.margins.top;

  if (logoBuffer) {
    try {
      doc.image(logoBuffer, left, top, { fit: [90, 60] });
    } catch {
      // Unsupported format (e.g. SVG — pdfkit only embeds raster images) — omit gracefully.
    }
  }

  doc
    .fontSize(18)
    .fillColor("#111827")
    .text(title, left, top, { align: "right", width: doc.page.width - left - doc.page.margins.right });
  doc
    .fontSize(11)
    .fillColor("#4B5563")
    .text(documentNumber, { align: "right" });

  doc.moveDown(1.2);
  doc.fontSize(10).fillColor("#111827").text(freelancer.fullName, left, doc.y, { align: "left" });
  doc.fontSize(9).fillColor("#6B7280").text(`${freelancer.taxIdType} ${freelancer.taxIdNumber}`);
  doc.moveDown(0.8);
  doc.strokeColor("#E5E7EB").moveTo(left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
  doc.moveDown(0.8);
  doc.fillColor("#000000");
}

function drawMeta(
  doc: PDFKit.PDFDocument,
  params: { issueDate: string; dueDate: string; client: FinancePdfClient }
) {
  const left = doc.page.margins.left;
  const colWidth = (doc.page.width - left - doc.page.margins.right) / 2;

  const startY = doc.y;
  doc.fontSize(9).fillColor("#6B7280").text("CLIENTE", left, startY);
  doc.fontSize(11).fillColor("#111827").text(params.client.clientName, left, doc.y + 2);
  if (params.client.clientTaxId) {
    doc.fontSize(9).fillColor("#6B7280").text(params.client.clientTaxId, left, doc.y + 2);
  }

  const rightX = left + colWidth;
  doc.fontSize(9).fillColor("#6B7280").text("FECHA DE EMISIÓN", rightX, startY);
  doc.fontSize(11).fillColor("#111827").text(formatDate(params.issueDate), rightX, doc.y + 2);
  doc.fontSize(9).fillColor("#6B7280").text("FECHA DE VENCIMIENTO", rightX, doc.y + 8);
  doc.fontSize(11).fillColor("#111827").text(formatDate(params.dueDate), rightX, doc.y + 2);

  doc.fillColor("#000000");
  doc.moveDown(2);
}

/** Draws the items table when itemized, returns the computed subtotal (should already match the stored `amount`). */
function drawItemsTable(doc: PDFKit.PDFDocument, items: FinancePdfLineItem[], currency: string) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const width = right - left;
  const colDesc = left;
  const colQty = left + width * 0.5;
  const colUnit = left + width * 0.68;
  const colTotal = left + width * 0.84;

  doc.fontSize(9).fillColor("#6B7280");
  const headerY = doc.y;
  doc.text("DESCRIPCIÓN", colDesc, headerY, { width: width * 0.48 });
  doc.text("CANTIDAD", colQty, headerY, { width: width * 0.16, align: "right" });
  doc.text("VALOR UNIT.", colUnit, headerY, { width: width * 0.14, align: "right" });
  doc.text("SUBTOTAL", colTotal, headerY, { width: right - colTotal, align: "right" });
  doc.moveDown(0.6);
  doc.strokeColor("#E5E7EB").moveTo(left, doc.y).lineTo(right, doc.y).stroke();
  doc.moveDown(0.4);

  doc.fillColor("#111827").fontSize(10);
  for (const item of items) {
    const lineTotal = item.quantity * item.unitAmount;
    const rowY = doc.y;
    doc.text(item.description, colDesc, rowY, { width: width * 0.48 });
    const rowBottom = doc.y;
    doc.text(String(item.quantity), colQty, rowY, { width: width * 0.16, align: "right" });
    doc.text(formatCOP(item.unitAmount, currency), colUnit, rowY, { width: width * 0.14, align: "right" });
    doc.text(formatCOP(lineTotal, currency), colTotal, rowY, { width: right - colTotal, align: "right" });
    doc.y = Math.max(doc.y, rowBottom);
    doc.moveDown(0.5);
  }

  doc.strokeColor("#E5E7EB").moveTo(left, doc.y).lineTo(right, doc.y).stroke();
  doc.moveDown(0.6);
}

function drawTotalRow(doc: PDFKit.PDFDocument, label: string, value: string, opts: { bold?: boolean } = {}) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  doc
    .font(opts.bold ? "Helvetica-Bold" : "Helvetica")
    .fontSize(opts.bold ? 13 : 10)
    .fillColor(opts.bold ? "#111827" : "#4B5563")
    .text(label, left, doc.y, { continued: true, width: (right - left) * 0.6 })
    .text(value, { align: "right" });
  doc.font("Helvetica");
  doc.moveDown(0.3);
}

function finalizeDoc(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

export async function renderCuentaDeCobroPdf(input: CuentaDeCobroPdfInput): Promise<Buffer> {
  const logoBuffer = await tryFetchLogo(input.logoFileKey);
  const doc = new PDFDocument({ margin: 50, size: "letter" });

  drawHeader(doc, {
    title: "CUENTA DE COBRO",
    documentNumber: input.documentNumber,
    freelancer: input.freelancer,
    logoBuffer,
  });
  drawMeta(doc, { issueDate: input.issueDate, dueDate: input.dueDate, client: input.client });

  doc.fontSize(9).fillColor("#6B7280").text("CONCEPTO");
  doc.fontSize(11).fillColor("#111827").text(input.concept);
  doc.moveDown(0.8);

  if (input.items && input.items.length > 0) {
    drawItemsTable(doc, input.items, input.currency);
  }

  doc.moveDown(0.4);
  drawTotalRow(doc, "Total a cobrar", formatCOP(input.amount, input.currency), { bold: true });

  return finalizeDoc(doc);
}

export async function renderInvoicePdf(input: InvoicePdfInput): Promise<Buffer> {
  const logoBuffer = await tryFetchLogo(input.logoFileKey);
  const doc = new PDFDocument({ margin: 50, size: "letter" });

  drawHeader(doc, {
    title: "FACTURA",
    documentNumber: input.documentNumber,
    freelancer: input.freelancer,
    logoBuffer,
  });
  drawMeta(doc, { issueDate: input.issueDate, dueDate: input.dueDate, client: input.client });

  if (input.items && input.items.length > 0) {
    drawItemsTable(doc, input.items, input.currency);
  } else {
    doc.fontSize(9).fillColor("#6B7280").text("SUBTOTAL");
    doc.fontSize(11).fillColor("#111827").text(formatCOP(input.amount, input.currency));
    doc.moveDown(0.8);
  }

  doc.moveDown(0.4);
  drawTotalRow(doc, "Subtotal", formatCOP(input.amount, input.currency));
  drawTotalRow(doc, "IVA", formatCOP(input.taxAmount, input.currency));
  drawTotalRow(doc, "Total", formatCOP(input.totalAmount, input.currency), { bold: true });

  doc.moveDown(1);
  doc
    .fontSize(8)
    .fillColor("#9CA3AF")
    .text("Facturación electrónica DIAN: no aplica en esta versión.", doc.page.margins.left, doc.y);

  return finalizeDoc(doc);
}
