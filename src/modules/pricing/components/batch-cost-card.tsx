import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatMoney } from "@/lib/format";
import { batchCost } from "../queries";

/**
 * A batch's direct cost against its revenue and margin, for the manager. Wrap
 * the caller in `<RoleGate role="manager">` — encoders don't see cost.
 */
export async function BatchCostCard({ id }: { id: string }) {
  const cost = await batchCost(id);

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Cost and margin</CardTitle>
        <CardDescription>
          Direct cost — electricity and labor — against revenue.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          {(
            [
              ["Electricity", formatMoney(cost.electricityMinor)],
              ["Labor", formatMoney(cost.laborMinor)],
              ["Revenue", formatMoney(cost.revenueMinor)],
            ] as [string, string][]
          ).map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
          <div className="contents">
            <dt className="text-muted-foreground">Margin</dt>
            <dd className="text-base font-semibold">
              {formatMoney(cost.marginMinor)}
            </dd>
          </div>
          <div className="contents">
            <dt className="text-muted-foreground">Margin per kg</dt>
            <dd className="font-medium">{formatMoney(cost.perKgMinor)}/kg</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
