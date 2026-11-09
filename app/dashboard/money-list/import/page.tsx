import { PageHeader } from "@/components/ui";
import { ImportWizard } from "@/components/moneylist/ImportWizard";

export const metadata = { title: "Import closed loans" };

export default function ImportPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Import closed loans" subtitle="Borrower, contact, property, loan amount, rate, closing date, prepay and interest-only. No SSNs, no documents." />
      <ImportWizard />
    </div>
  );
}
