import { SectionPlaceholder } from "@/components/layout/section-placeholder";

export default function FinancePage() {
  return (
    <SectionPlaceholder
      title="Finance"
      description="Cuentas de cobro, invoicing, payment follow-up, PILA, and your tax vault."
      phase="Phases 7, 9–10, 12"
      screens={[
        "Cuentas de cobro generator",
        "Invoices",
        "Payments & overdue dashboard",
        "Withholding-certificate tracker",
        "PILA calculator & guided operator hand-off",
        "Tax-document vault",
        "Subscription / billing settings",
      ]}
    />
  );
}
