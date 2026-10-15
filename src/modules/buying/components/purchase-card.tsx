import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatKg, formatMoney } from "@/lib/format";
import { requireRole } from "@/modules/accounts/auth";
import type { Deductions } from "@/modules/pricing/logic";
import { purchaseByBatch } from "../queries";
import { VoucherForm } from "./voucher-form";

/**
 * The purchase priced from an IRPC batch's receiving, shown to the encoder with
 * the deductions and the running voucher number. Nothing renders for a custom
 * batch, which has no purchase.
 */
export async function PurchaseCard({ id }: { id: string }) {
  await requireRole();
  const purchase = await purchaseByBatch(id);
  if (!purchase) return null;
  const deductions = purchase.deductions as Deductions;

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Purchase</CardTitle>
        <CardDescription>
          Priced from the receiving report on today&apos;s prices.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          {(
            [
              ["Net weight", formatKg(purchase.net_kg)],
              ["Damaged", formatKg(deductions.damaged)],
              ["Immature", formatKg(deductions.immature)],
              ["Foreign matter", formatKg(deductions.foreign)],
              ["Sacks", formatKg(deductions.sack)],
              ["Paid weight", formatKg(purchase.paid_kg)],
              ["Price", `${formatMoney(purchase.price_minor_per_kg)}/kg`],
            ] as [string, string][]
          ).map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
          <div className="contents">
            <dt className="text-muted-foreground">Total</dt>
            <dd className="text-base font-semibold">
              {formatMoney(purchase.total_minor)}
            </dd>
          </div>
        </dl>
        <VoucherForm batchId={id} current={purchase.voucher_ref} />
      </CardContent>
    </Card>
  );
}
