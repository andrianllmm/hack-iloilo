import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "cn";
import { formatKg } from "@/lib/format";
import { requireRole } from "@/modules/accounts/auth";
import { serviceLabels, stageLabels } from "../logic";
import { listBatches } from "../queries";
import type { Batch, BatchListRow } from "../types";

const stages: Batch["stage"][] = [
  "received",
  "drying",
  "stored",
  "milling",
  "milled",
  "dispatched",
];

const day = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeZone: "Asia/Manila",
});

/** The weight to show for a batch: the latest one it has recorded. */
function weight(batch: BatchListRow): string {
  const kg = batch.rice_kg ?? batch.dried_kg ?? batch.net_kg;
  return kg ? formatKg(kg) : "—";
}

export async function BatchesList({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole();
  const params = await searchParams;
  const stage = stages.find((s) => s === params.stage);
  const batches = await listBatches(stage);

  return (
    <section className="flex min-w-0 flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Batches</h1>
        <p className="text-sm text-muted-foreground">
          Batch records from receiving to dispatch.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2" aria-label="Filter by stage">
        <FilterLink label="All" active={!stage} href="/batches" />
        {stages.map((s) => (
          <FilterLink
            key={s}
            label={stageLabels[s]}
            active={stage === s}
            href={`/batches?stage=${s}`}
          />
        ))}
      </nav>

      {batches.length === 0 ? (
        <p className="text-sm text-muted-foreground">No batches yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Line</TableHead>
                <TableHead>Ownership</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead className="text-right">Weight</TableHead>
                <TableHead>Opened</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.map((batch) => (
                <TableRow key={batch.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/batches/${batch.id}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {batch.batch_no}
                    </Link>
                  </TableCell>
                  <TableCell>{batch.client.name}</TableCell>
                  <TableCell>
                    {batch.entry ? serviceLabels[batch.entry.service] : "—"}
                  </TableCell>
                  <TableCell>
                    {batch.ownership === "irpc" ? "IRPC" : "Custom"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {stageLabels[batch.stage]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{weight(batch)}</TableCell>
                  <TableCell>
                    {day.format(new Date(batch.created_at))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}

function FilterLink({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full border px-3 py-1 text-sm transition-colors",
        active
          ? "border-transparent bg-primary text-primary-foreground"
          : "border-input hover:bg-accent hover:text-accent-foreground",
      )}
    >
      {label}
    </Link>
  );
}
