import { impersonate } from "@/lib/actions/admin";
import { Button } from "@/components/ui";

export function ImpersonateButton({ brokerId, size = "sm" }: { brokerId: string; size?: "sm" | "md" }) {
  return (
    <form action={impersonate.bind(null, brokerId)}>
      <Button variant="secondary" size={size}>Impersonate →</Button>
    </form>
  );
}
