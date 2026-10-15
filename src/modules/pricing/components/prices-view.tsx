import { ServiceLabel } from "@/components/service-icon";
import { StatusBadge } from "@/components/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { splitManila, todayManila } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { livePrice } from "../logic";
import { listPrices } from "../queries";

export async function PricesView() {
  const prices = await listPrices();
  const today = todayManila();
  const liveId = livePrice(prices, today)?.id;

  if (prices.length === 0) {
    return <p className="text-sm text-muted-foreground">No prices set yet.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Effective</TableHead>
          <TableHead>Saved</TableHead>
          <TableHead className="text-right">Buy base</TableHead>
          <TableHead className="text-right">
            <ServiceLabel kind="drying">Drying</ServiceLabel>
          </TableHead>
          <TableHead className="text-right">
            <ServiceLabel kind="milling">Milling</ServiceLabel>
          </TableHead>
          <TableHead className="text-right">Rice</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {prices.map((p) => {
          const saved = splitManila(p.created_at);
          return (
            <TableRow key={p.id}>
              <TableCell>
                <span className="flex items-center gap-2">
                  {p.effective_date}
                  {p.id === liveId && (
                    <StatusBadge tone="success">In effect</StatusBadge>
                  )}
                </span>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {saved.date} {saved.time}
              </TableCell>
              <TableCell className="text-right">
                {formatMoney(p.buy_base_minor_per_kg)}/kg
              </TableCell>
              <TableCell className="text-right">
                {formatMoney(p.drying_fee_minor_per_kg)}/kg
              </TableCell>
              <TableCell className="text-right">
                {formatMoney(p.milling_fee_minor_per_kg)}/kg
              </TableCell>
              <TableCell className="text-right">
                {formatMoney(p.rice_minor_per_kg)}/kg
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
